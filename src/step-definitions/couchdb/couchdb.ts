import * as assert from 'assert';
import { binding } from 'cucumber-tsflow/dist';
import * as nano from 'nano';
import { then } from '../../decorators/steps';
import { Logger } from '../../utils/logger';
import { Workspace } from '../utils/workspace';

const logger = Logger.getLogger('./src/step-definitions/couchdb/couchdb.ts');

@binding([Workspace])
export class CouchDB {

    public constructor(private workspace: Workspace) {
        // construct
    }

    @then(/The world state for the chaincode ['"](.*)['"] on channel ['"](.*)['"] should contain ['"](.*)['"] for key ['"](.*)['"]/)
    public async readWorldState(chaincodeName: string, channelName: string, value: string, key: string) {
        for (const org of this.workspace.network.getOrganisations()) {
            logger.info(`Reading world state for ${org.name}`);

            if (!org.db) {
                continue;
            }

            const worldState = nano(`http://127.0.0.1:${org.db.externalPort}`).db.use(`${channelName}_${chaincodeName}`);

            const resp = await worldState.attachment.get(key, 'valueBytes');

            assert.equal(resp, value);
        }
    }

    @then(/The world state for the chaincode ['"](.*)['"] on channel ['"](.*)['"] should not have key ['"](.*)['"]/)
    public async isDeletedFromWorldState(chaincodeName: string, channelName: string, key: string) {
        for (const org of this.workspace.network.getOrganisations()) {
            if (!org.db) {
                continue;
            }

            const worldState = nano(`http://127.0.0.1:${org.db.externalPort}`).db.use(`${channelName}_${chaincodeName}`);

            try {
                await worldState.get(key);
                throw new Error('Key still exists in world state');
            } catch (err) {
                if (err.reason && err.reason === 'deleted') {
                    return;
                }

                throw err;
            }
        }
    }
}
