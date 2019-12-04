import { Peer } from '../../interfaces/interfaces';

export function getEnvVarsForCli(peer: Peer) {
    const peerFolder = `/etc/hyperledger/config/crypto-config/peerOrganizations/${peer.name.split('.').slice(1).join('.')}/peers/${peer.name}`;

    const addr = `CORE_PEER_ADDRESS="${peer.name}:${peer.port}"`;
    const tlsKey = `CORE_PEER_TLS_KEY_FILE="${peerFolder}/tls/server.key"`;
    const tlsCert = `CORE_PEER_TLS_CERT_FILE="${peerFolder}/tls/server.crt"`;
    const tlsRootCert = `CORE_PEER_TLS_ROOTCERT_FILE="${peerFolder}/tls/ca.crt"`;

    return `${addr} ${tlsKey} ${tlsCert} ${tlsRootCert}`;
}

export async function sleep(time: number) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, time);
    });
}
