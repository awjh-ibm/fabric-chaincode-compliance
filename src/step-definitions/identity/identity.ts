import { TableDefinition } from 'cucumber';
import { binding, given } from 'cucumber-tsflow/dist';
import { Gateway, X509WalletMixin } from 'fabric-network';
import * as fs from 'fs-extra';
import { Workspace } from '../utils/workspace';

@binding([Workspace])
export class Identity {
    public constructor(private workspace: Workspace) {
        // construct
    }

    @given(/Organisation "(.*)" has registered the identity "(.*)"$/)
    public async registerUser(orgName: string, identityName: string) {
        await this.registerUserWithAttr(orgName, identityName, null);
    }

    @given(/Organisation "(.*)" has registered the identity "(.*)" with attributes:/)
    public async registerUserWithAttr(orgName: string, identityName: string, attributesTbl: TableDefinition) {
        const org = this.workspace.network.getOrganisation(orgName);

        const wallet = org.wallet;

        const identityExists = await wallet.exists(identityName);

        if (identityExists) {
            throw new Error(`Identity "${identityName}" already exists for organisation "${orgName}"`);
        }

        const attrs = [];

        if (attributesTbl) {
            for (const row of attributesTbl.rows()) {
                if (row.length !== 2) {
                    throw new Error('Attributes table invalid');
                }

                attrs.push({name: row[0], value: row[1], ecert: true});
            }
        }

        const adminExists = await wallet.exists('admin');

        if (!adminExists) {
            throw new Error(`Missing admin for organisation "${orgName}"`);
        }

        const gateway = new Gateway();
        await gateway.connect(org.ccp, {wallet: org.wallet, identity: 'admin', discovery: {enabled: true, asLocalhost: true}});

        const ca = gateway.getClient().getCertificateAuthority();
        const adminIdentity = gateway.getCurrentIdentity();

        // Register the user, enroll the user, and import the new identity into the wallet.
        const secret = await ca.register({ affiliation: '', enrollmentID: identityName, role: 'client', attrs }, adminIdentity);
        const enrollment = await ca.enroll({ enrollmentID: identityName, enrollmentSecret: secret });
        const userIdentity = X509WalletMixin.createIdentity(org.mspid, enrollment.certificate, enrollment.key.toBytes());
        await wallet.import(identityName, userIdentity);
    }
}
