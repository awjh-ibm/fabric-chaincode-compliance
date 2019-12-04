import * as FabricCAServices from 'fabric-ca-client';
import { FileSystemWallet, X509WalletMixin } from 'fabric-network';
import * as fs from 'fs-extra';
import * as Handlebars from 'handlebars';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { BaseComponent, CA, Channel, Orderer, Org, Peer, Profile } from '../interfaces/interfaces';
import { Docker } from '../utils/docker';

export enum NetworkType {
    SINGLE_ORG,
}

export interface NetworkDetails {
    resourceFolder: string;
    tag: string;
}

export interface NetworkConfiguration {
    organisations: Org[];
    orderers: Orderer[];
    profiles: Map<string, Profile>;
}

const networkResources = path.resolve(__dirname, '../../resources/networks');
const networkComposeFile = 'docker-compose/docker-compose.yaml';
const cliComposeFile = path.join(networkResources, 'shared', 'docker-compose/docker-compose-cli.yaml');

export class Network {
    private name: string;
    private type: NetworkType;
    private details: NetworkDetails;
    private config: NetworkConfiguration;
    private channels: Map<string, Channel>;

    public constructor(type: NetworkType) {
        this.name = networkTypeToString(type);
        this.type = type;
        this.details = {
            resourceFolder: path.join(networkResources, this.name),
            tag: '@' + this.name.replace(/([-][a-z])/g, (group) => group.toUpperCase().replace('-', '')),
        };

        this.config = {
            orderers: this.parseOrderers(),
            organisations: this.parseOrgs(),
            profiles: this.parseProfiles(),
        };

        this.channels = new Map<string, Channel>();
    }

    public async build() {
        await this.teardownExisting();
        await this.createOrgsNetworkInteractionFiles();
        this.configureEnvVars();
        await this.generateCrypto();
        await Docker.composeUp(path.join(networkResources, this.name, networkComposeFile), this.name);
        await this.enrollAdmins();
    }

    public async teardown() {
        await this.teardownNetwork(this.name);
        await this.cleanupChaincode();
    }

    public async addChannel(channel: Channel) {
        this.channels.set(channel.name, channel);
    }

    public getProfile(profile: string): Profile {
        if (!this.config.profiles.has(profile)) {
            throw new Error(`Profile "${profile}" not found`);
        }

        return this.config.profiles.get(profile);
    }

    public getDefaultOrderer(): Orderer {
        return this.config.orderers[0];
    }

    public getChannel(channel: string): Channel {
        if (!this.channels.has(channel)) {
            throw new Error(`Channel "${channel}" not found`);
        }

        return this.channels.get(channel);
    }

    public getOrganisation(orgName: string): Org {
        for (const org of this.config.organisations) {
            if (org.name === orgName) {
                return org;
            }
        }

        throw new Error(`Org "${orgName}" not found`);
    }

    private async createOrgsNetworkInteractionFiles() {
        for (const org of this.config.organisations) {
            await this.createCcp(org);
            await this.createWallet(org.name);
        }
    }

    private async enrollAdmins() {
        for (const org of this.config.organisations) {
            const orgCa = org.cas[0];
            const rootCert = await fs.readFile(orgCa.trustedRootCert);

            const ca = new FabricCAServices(
                `https://localhost:${orgCa.externalPort}`, { trustedRoots: rootCert, verify: false }, orgCa.name,
            );

            const wallet = org.wallet;
            const adminExists = await wallet.exists('admin');

            if (adminExists) {
                continue;
            }

            const enrollment = await ca.enroll({enrollmentID: 'admin', enrollmentSecret: 'adminpw'});

            const identity = X509WalletMixin.createIdentity(org.mspid, enrollment.certificate, enrollment.key.toBytes());
            await wallet.import('admin', identity);
        }
    }

    private parseOrgs(): Org[] {
        const rawCryptoConfig = fs.readFileSync(path.join(this.details.resourceFolder, 'crypto-material/crypto-config.yaml'), 'utf8');
        const cryptoConfig = yaml.safeLoad(rawCryptoConfig);

        return cryptoConfig.PeerOrgs.map((org) => {
            const orgIface: Org = {
                cas: this.parseCAs(org.Name),
                ccp: this.getCcpPath(org.Name),
                cli: orgToSmall(org.Name) + '_cli',
                mspid: org.Name + 'MSP',
                name: org.Name,
                peers: this.parsePeers(org.Name),
                wallet: new FileSystemWallet(this.getWalletPath(org.Name)),
            };

            return orgIface;
        });
    }

    private parseProfiles(): Map<string, Profile> {
        const rawConfigTx = fs.readFileSync(path.join(this.details.resourceFolder, 'crypto-material/configtx.yaml'), 'utf8');
        const configTx = yaml.safeLoad(rawConfigTx);

        const profiles = new Map();
        for (const profileName in configTx.Profiles) {
            if (configTx.Profiles.hasOwnProperty(profileName)) {
                profiles.set(profileName, {
                    organisations: configTx.Profiles[profileName].Application.Organizations.map((org) => {
                        const name = org.Name.split('MSP')[0];
                        const orgIface: Org = {
                            cas: this.parseCAs(name),
                            ccp: this.getCcpPath(name),
                            cli: orgToSmall(name) + '_cli',
                            mspid: org.Name,
                            name,
                            peers: this.parsePeers(name),
                            wallet: new FileSystemWallet(this.getWalletPath(name)),
                        };
                        return orgIface;
                    }),
                });
            }
        }

        return profiles;
    }

    private getWalletPath(org: string): string {
        return path.join(this.details.resourceFolder, 'wallets', org);
    }

    private async createWallet(org: string) {
        await fs.mkdirp(this.getWalletPath(org));
    }

    private async createCcp(org: Org) {
        const ccpPath = this.getCcpPath(org.name);

        if (!(await fs.pathExists(ccpPath))) {
            const rawTmpl = (await fs.readFile(path.join(networkResources, 'shared', 'connection-profiles/connection_profile.hbr'))).toString();
            const tmpl = Handlebars.compile(rawTmpl);

            const orgClone = JSON.parse(JSON.stringify(org));
            orgClone.orderers = [this.getDefaultOrderer()];
            orgClone.cryptoConfigPath = path.join(this.details.resourceFolder, 'crypto-material/crypto-config');

            await fs.ensureFile(ccpPath);
            await fs.writeFile(ccpPath, tmpl(orgClone));
        }

        return ccpPath;
    }

    private getCcpPath(org: string): string {
        const ccpFolder = path.join(this.details.resourceFolder, 'connection-profiles');
        const ccpPath = path.join(ccpFolder, `${org}-connection-profile.json`);

        return ccpPath;
    }

    private parseOrderers(): Orderer[] {
        const rawDockerCompose = fs.readFileSync(path.join(this.details.resourceFolder, 'docker-compose/docker-compose.yaml'), 'utf8');
        const dockerCompose = yaml.safeLoad(rawDockerCompose);

        const orderers: Orderer[] = [];

        for (const serviceName in dockerCompose.services) {
            if (dockerCompose.services.hasOwnProperty(serviceName)) {
                const service = dockerCompose.services[serviceName];
                if (service.hasOwnProperty('extends') && service.extends.hasOwnProperty('service') && service.extends.service === 'orderer') {
                    orderers.push({
                        externalPort: service.ports[0].split(':')[1],
                        name: serviceName,
                        port: service.ports[0].split(':')[0],
                    });
                }
            }
        }

        return orderers;
    }

    private parseComponent(org: string, type: 'peer' | 'ca'): BaseComponent[] {
        const rawDockerCompose = fs.readFileSync(path.join(this.details.resourceFolder, 'docker-compose/docker-compose.yaml'), 'utf8');
        const dockerCompose = yaml.safeLoad(rawDockerCompose);

        const components: BaseComponent[] = [];

        const identifier = type === 'peer' ? 'peer[0-9]*' : 'tlsca';

        for (const serviceName in dockerCompose.services) {
            if (dockerCompose.services.hasOwnProperty(serviceName)) {
                const service = dockerCompose.services[serviceName];
                if (service.hasOwnProperty('extends') && service.extends.hasOwnProperty('service') && service.extends.service === type) {
                    const pattern = `${identifier}\\.${orgToSmall(org)}\\.com`;
                    const regex = new RegExp(pattern);

                    if (regex.test(serviceName)) {
                        components.push({
                            externalPort: service.ports[0].split(':')[0],
                            name: serviceName,
                            port: service.ports[0].split(':')[0],
                        });
                    }
                }
            }
        }
        return components;
    }

    private parsePeers(org: string): Peer[] {
        const peers = this.parseComponent(org, 'peer');

        peers.forEach((peer) => {
            (peer as Peer).eventPort = peer.port + 2;
            (peer as Peer).externalEventPort = peer.externalPort + 2;
        });

        return peers as Peer[];
    }

    private parseCAs(org: string): CA[] {
        const cas = this.parseComponent(org, 'ca');
        cas.forEach((ca) => {
            (ca as CA).trustedRootCert = path.join(this.details.resourceFolder, `crypto-material/crypto-config/peerOrganizations/${orgToSmall(org)}.com/tlsca/${ca.name}-cert.pem`);
        });

        return cas as CA[];
    }

    public async teardownExisting() {
        const networkNames: string[] = Object.keys(NetworkType).filter((key) => {
            return typeof NetworkType[key] !== 'number';
        }).map((key: any) => {
            return networkTypeToString(key);
        });

        const upNetworks = await Docker.projectsUp(...networkNames);
        for (const network of upNetworks) {
            await this.teardownNetwork(network);
        }

        await this.cleanupChaincode();
    }

    private async teardownNetwork(network: string) {
        await Docker.composeDown(path.join(networkResources, network, networkComposeFile), network);
        await this.cleanupCrypto(network);
        await fs.remove(path.join(this.details.resourceFolder, 'wallets'));
        await fs.remove(path.join(this.details.resourceFolder, 'connection-profiles'));
    }

    private configureEnvVars() {
        process.env.FABRIC_IMG_TAG = ':1.4.1';
        process.env.FABRIC_COUCHDB_TAG = ':0.4.15';
        process.env.FABRIC_DEBUG = 'info';
        process.env.NETWORK_FOLDER = this.details.resourceFolder;
    }

    private async generateCrypto() {
        await Docker.composeUp(cliComposeFile);

        await Docker.exec('cli', 'cryptogen generate --config=/etc/hyperledger/config/crypto-config.yaml --output /etc/hyperledger/config/crypto-config');
        await Docker.exec('cli', 'configtxgen -profile Genesis -outputBlock /etc/hyperledger/config/genesis.block');
        await Docker.exec('cli', 'cp /etc/hyperledger/fabric/core.yaml /etc/hyperledger/config');
        await Docker.exec('cli', 'sh /etc/hyperledger/tools/rename_sk.sh');

        await Docker.composeDown(cliComposeFile, null, true);
    }

    private async cleanupCrypto(network: string) {
        process.env.NETWORK_FOLDER = path.join(networkResources, network);

        await Docker.composeUp(cliComposeFile);
        await Docker.exec('cli', `bash -c 'cd /etc/hyperledger/config; rm -rf crypto-config; rm -f *.tx; rm -f core.yaml; rm -f *.block; rm -f $(ls | grep -e \'.*_anchors.tx\')'`);
        await Docker.composeDown(cliComposeFile, null, true);
    }

    private async cleanupChaincode() {
        await Docker.removeContainers('dev-peer');
        await Docker.removeImages('dev-peer');
    }
}

function orgToSmall(orgName) {
    if (orgName.toUpperCase() === orgName) {
        return orgName.toLowerCase();
    }

    return orgName.replace(/(?:^|\.?)([A-Z])/g, (x, y: string) => '-' + y.toLowerCase()).replace(/^-/, '');
}

function networkTypeToString(type: NetworkType): string {
    return NetworkType[type].toLowerCase().split('_').join('-');
}
