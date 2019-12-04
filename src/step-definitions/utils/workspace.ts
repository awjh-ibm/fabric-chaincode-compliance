import { Global } from '../../interfaces/interfaces';
import { Network } from '../../network/network';

declare const global: Global;

interface ChaincodeConfig {
    policy: string;
    collection: string;
}

export class Workspace {

    public network: Network;
    public language: string;
    public chaincodes: Map<string, ChaincodeConfig>;

    public constructor() {
        this.network = global.CURRENT_NETWORK;
        this.language = global.CHAINCODE_LANGUAGE;
        this.chaincodes = new Map();
    }

    public updateChaincodePolicy(chaincode: string, policy: string) {
        const config = this.getConfig(chaincode);
        config.policy = policy;

        this.chaincodes.set(chaincode, config);
    }

    public updateChaincodeCollection(chaincode: string, collection: string) {
        const config = this.getConfig(chaincode);
        config.collection = collection;

        this.chaincodes.set(chaincode, config);
    }

    private getConfig(chaincodeName: string) {
        let config: ChaincodeConfig = {
            collection: null,
            policy: null,
        };

        if (this.chaincodes.has(chaincodeName)) {
            config = this.chaincodes.get(chaincodeName);
        }

        return config;
    }
}
