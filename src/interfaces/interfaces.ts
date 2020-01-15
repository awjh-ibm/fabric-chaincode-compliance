import { Wallet } from 'fabric-network';
import { Network } from '../network/network';

export interface Org {
    name: string;
    cli: string;
    mspid: string;
    peers: Peer[];
    cas: CA[];
    wallet: Wallet;
    ccp: string;
    db: DB;
}

export interface BaseComponent {
    name: string;
    port: number;
    externalPort: number;
}

// tslint:disable-next-line: no-empty-interface
export interface Orderer extends BaseComponent {
}

export interface Profile {
    organisations: Org[];
}

export interface Global extends NodeJS.Global {
    CHAINCODE_LANGUAGE: 'golang' | 'java' | 'node';
    CURRENT_NETWORK: Network;
    LOGGING_LEVEL: 'info' | 'debug';
}

export interface Channel {
    name: string;
    organisations: Org[];
}

// tslint:disable-next-line: no-empty-interface
export interface Peer extends BaseComponent {
    eventPort: number;
    externalEventPort: number;
}

// tslint:disable-next-line: no-empty-interface
export interface CA extends BaseComponent {
    trustedRootCert: string;
}

export interface DB extends BaseComponent {
    type: 'level' | 'couch';
}

export interface Step {
    text: string;
    complete: boolean;
}

export interface Scenario {
    name: string;
    steps: Step[];
}

export interface Feature {
    name: string;
    scenarios: Scenario[];
}
