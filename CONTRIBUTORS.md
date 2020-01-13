# Contributing

We welcome contributions to the Hyperledger Fabric Project in many forms, and there's always plenty to do!

Please visit the [contributors guide](https://hyperledger-fabric.readthedocs.io/en/latest/CONTRIBUTING.html) in the docs to learn how to make contributions to this exciting project.

## Folder Structure

This repo contains the source code for the CLI tool fabric-chaincode-compliance as well as the features and resources needed to run the tool.

- `src`
    - contains the code for the CLI commands as well as the step definitions for the features.
- `features`
    - contains the cucumber files that define the tests to be run by the CLI
- `resources`
    - `chaincode`
        - an empty folder where chaincode to be used with the CLI is copied across temporarily whilst the tool runs
    - `networks`
        - contains sub-folders which define networks to run features against e.g. single-org
        - `scripts`
            - contains generic scripts used across different network setups
        - `shared`
            - contains docker-compose components to be extended in other network definitions

## Defining a new network
To define a new network you will need to create a new folder for the network in `resources/networks` where the name of the network to be referenced in the features files should be written in snake case. Inside that folder you will need a `crypto-material` folder containing your `configtx.yaml` and `crypto-config.yaml` files. The new network must also contain a `docker-compose` folder which must (but may not solely) contain a `docker-compose.yaml` file which defines the network.

Once you have the new network structure you will then need to tag features that will use the network with the folder name.

### Requirements
- Network
    - Must operate using TLS
    - Profile defined in `configtx.yaml` for the genesis block must be called `Genesis`
    - Organisation's MSP ID should be `<ORG_NAME>MSP` e.g. Org1MSP
    - Organisations MSP Directory should be `crypto-config/peerOrganizations/<ORG_NAME>.com/msp`
- Peers
    - Container name and peer name must match
    - Peer name must be of the form `peerN.<ORG_NAME>.com` where ORG_NAME is the snake case version of the organisation's name e.g. org1
    - Must extend `peer` service from `shared/docker-compose/docker-compose-base.yaml`
- Certificate Authorities
    - Container name and CA server name must match
    - CA name must be of the form `tlsca.<ORG_NAME>.com` where ORG_NAME is the snake case version of the organisation's name e.g. org1
    - Must extend `ca` service from `shared/docker-compose/docker-compose-base.yaml`
- Databases
    - DB name must be of the form `<TYPE>db.<ORG_NAME>.com` when ORG_NAME is the snake case version of the organisation's name e.g. org1 ad the type is couch or level
    - Must extend the `<TYPE>db` service from `shared/docker-compose/docker-compose-base.yaml` e.g. couchdb
- CLI
    - All organisations require a CLI. This is used by the step definitions to issue peer commands
    - CLI name must be of the form `<ORG_NAME>_cli` where ORG_NAME is the snake case version of the organisation's name e.g. org1
    - Must extend `clibase` service from `shared/docker-compose/docker-compose-base.yaml`