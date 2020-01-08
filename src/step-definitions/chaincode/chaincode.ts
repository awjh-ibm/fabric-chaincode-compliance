import { TableDefinition } from 'cucumber';
import { binding, given, then, when } from 'cucumber-tsflow/dist';
import { Gateway } from 'fabric-network';
import * as path from 'path';
import { Policy } from '../../policy/policy';
import { Docker } from '../../utils/docker';
import { getEnvVarsForCli, sleep } from '../utils/functions';
import { Workspace } from '../utils/workspace';

@binding([Workspace])
export class Chaincode {

    public constructor(private workspace: Workspace) {
        // construct
    }

    @given(/All peers on channel "(.*)" have installed the chaincode "(.*)"$/)
    public async installAll(channelName: string, chaincodeName: string) {
        const channel = this.workspace.network.getChannel(channelName);

        let prefix = '';

        if (this.workspace.language !== 'golang') {
            prefix = '/gopath/src/';
        } else {
            await Docker.exec(channel.organisations[0].cli, `bash -c 'cd /opt/gopath/src/github.com/hyperledger/fabric-chaincode-compliance/${chaincodeName} && GO111MODULE=on GOCACHE=on go mod vendor'`);
        }

        for (const org of channel.organisations) {
            for (const peer of org.peers) {
                await Docker.exec(org.cli, `bash -c '${getEnvVarsForCli(peer)} peer chaincode install -l ${this.workspace.language} -n ${chaincodeName} -v 0 -p "${prefix}github.com/hyperledger/fabric-chaincode-compliance/${chaincodeName}"'`);
            }
        }
    }

    @given(/Chaincode "(.*)" when instantiated on channel "(.*)" will use endorsement policy "(.*)"$/)
    public async configureEndorsementPolicy(chaincodeName: string, channelName: string, policyName: string) {
        const policy = Policy.build(policyName, this.workspace.network.getChannel(channelName));

        this.workspace.updateChaincodePolicy(chaincodeName, policy);
    }

    @given(/Chaincode "(.*)" when instantiated on channel "(.*)" will use private data collection "(.*)"$/)
    public async configurePrivateCollection(chaincodeName: string, _: string, collectionFile: string) {
        const collection = path.join(__dirname, '../../..', 'resources/private_collections', collectionFile);

        this.workspace.updateChaincodeCollection(chaincodeName, collection);
    }

    @given(/Organisation "(.*)" has instantiated the chaincode "(.*)" on channel "(.*)"$/)
    public async instantiateNoArgs(orgName: string, chaincodeName: string, channelName: string) {
        await this.instantiate(orgName, chaincodeName, channelName, null, null);
    }

    @given(/Organisation "(.*)" has instantiated the chaincode "(.*)" on channel "(.*)" calling "(.*)" with args:$/)
    public async instantiate(orgName: string, chaincodeName: string, channelName: string, functionName: string, args: TableDefinition) {
        const org = this.workspace.network.getOrganisation(orgName);
        const peer = org.peers[0];

        const orderer = this.workspace.network.getDefaultOrderer();
        const parsedArgs = this.generateCLIArgs(functionName, args);

        let policy = '';
        let collection = '';

        if (this.workspace.chaincodes.has(chaincodeName)) {
            const chaincode = this.workspace.chaincodes.get(chaincodeName);
            if (chaincode.policy) {
                policy = `-P "${chaincode.policy.split('"').join('\\"')}"`;
            }
            if (chaincode.collection) {
                collection = `--collections-config ${chaincode.collection}`;
            }
        }

        await Docker.exec(org.cli, `bash -c '${getEnvVarsForCli(peer)} peer chaincode instantiate -o ${orderer.name}:${orderer.port} -l ${this.workspace.language} -C ${channelName} -n ${chaincodeName} -v 0 --tls true --cafile /etc/hyperledger/config/crypto-config/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem -c "{\\"Args\\": ${parsedArgs}}" ${policy} ${collection}'`);

        const attempts = 10;

        await sleep(2000);

        for (let i = 0; i < attempts; i++) {
            try {
                await this.handleTransaction(org.name, 'evaluate', chaincodeName, 'org.hyperledger.fabric:getMetadata', channelName, 'admin', []);
                break;
            } catch (err) {
                if (i === attempts - 1) {
                    console.log(err);
                    throw new Error('Waiting for chaincode to insantiate timedout');
                }
                await sleep(2000);
            }
        }
    }

    @when(/Organisation "(.*)" (submit|evaluate)s against the chaincode "(.*)" the transaction "(.*)" on channel "(.*)" as "(.*)"$/)
    public async whenSubmitNoArgs(
        orgName: string, type: 'submit' | 'evaluate', chaincodeName: string, functionName: string, channelName: string, identityName: string,
    ) {
        this.whenSubmit(orgName, type, chaincodeName, functionName, channelName, identityName, null);
    }

    @when(/Organisation "(.*)" (submit|evaluate)s against the chaincode "(.*)" the transaction "(.*)" on channel "(.*)" as "(.*)" with args:$/)
    public async whenSubmit(
        orgName: string, type: 'submit' | 'evaluate', chaincodeName: string, functionName: string, channelName: string, identityName: string,
        args: TableDefinition,
    ) {
        await this.handleTransaction(orgName, type, chaincodeName, functionName, channelName, identityName, this.generateArgs(args));
    }

    @then(/Expecting result "(.*)" organisation "(.*)" (submit|evaluate)s against the chaincode "(.*)" the transaction "(.*)" on channel "(.*)" as "(.*)"$/)
    public async thenSubmitWithArgs(
        result: string, orgName: string, type: 'submit' | 'evaluate', chaincodeName: string, functionName: string, channelName: string, identityName: string,
    ) {
        await this.thenSubmit(result, orgName, type, chaincodeName, functionName, channelName, identityName, null);
    }

    @then(/Expecting result "(.*)" organisation "(.*)" (submit|evaluate)s against the chaincode "(.*)" the transaction "(.*)" on channel "(.*)" as "(.*)" with args:$/)
    public async thenSubmit(
        result: string, orgName: string, type: 'submit' | 'evaluate', chaincodeName: string, functionName: string, channelName: string, identityName: string,
        args: TableDefinition,
    ) {
        const data = await this.handleTransaction(orgName, type, chaincodeName, functionName, channelName, identityName, this.generateArgs(args));

        if (data !== result) {
            throw new Error(`Result did not match expected. Wanted ${result} got ${data}`);
        }
    }

    private async handleTransaction(
        orgName: string, type: 'submit' | 'evaluate', chaincodeName: string, functionName: string, channelName: string, identityName: string, args: string[],
    ): Promise<string> {
        const org = this.workspace.network.getOrganisation(orgName);

        const gateway = new Gateway();
        await gateway.connect(org.ccp, { wallet: org.wallet, identity: identityName, discovery: { enabled: true, asLocalhost: true } });
        // TODO why does the channel for this gateway sometimes have the wrong org's peers and no peers for this org
        const channel = await gateway.getNetwork(channelName);

        const contract = await channel.getContract(chaincodeName);

        const tx = contract.createTransaction(functionName);

        try {
            const data = await tx[type](...args);

            return data.toString();
        } catch (err) {
            console.log('ERROR', err);
            throw err;
        }
    }

    private generateArgs(args: TableDefinition): string[] {
        const txArgs = args ? args.raw()[0].map((arg) => {
            return arg;
        }) : [];

        return txArgs;
    }

    private generateCLIArgs(functionName: string, args: TableDefinition): string {
        if (!functionName || !args || args.raw().length === 0) {
            return '[]';
        }

        let data = `[\\"${functionName}\\", `;

        args.raw()[0].forEach((item) => {
            try {
                JSON.parse(item);
                data += `${JSON.stringify(item)}, `; // TODO check this works
            } catch (err) {
                data += `\\"${item}\\", `;
            }
        });

        data = data.substring(0, data.length - 2) + ']';

        return data;
    }
}
