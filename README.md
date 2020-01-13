# Fabric Chaincode/Contract Compliance

This is a test tool specifically designed to ensure that Fabric chaincode/contract implementations in all languages are complete and consistent.

## Structure of the tool

There are a set of different 'gerkin features' that drive tests for different aspects of the implementation. Each of these features will use one or more Fabric infrastructures and will use one or of required set of Chaincode and Contracts.

The Fabric infrastructure is supplied as part of the tool, the Chaincode and Contracts must be specified as these are the elements that are under test.

## Running the tool
### Pre-reqs

- Build environment setup for your chaincode language
- Node.js 10 or greater
- Docker and Docker Compose

### Usage
The tool is provided as an npm module. You can install this tool globally or locally to the test location

```
npm install -g @ampretia/fabric-chaincode-compliance
```

The tool can then be run as follows

```
fabric-chaincode-compliance --chaincode-dir <PATH_TO_CHAINCODE> --language <CHAINCODE_LANGUAGE>
```

## Defining chaincode for use with the tool
The tool is structured such that the chaincodes are referenced in the features by their folder name. Therefore in your supplied chaincode directory you will require your chaincode to be in folders of these names. The current chaincodes which are run are:
- simple

Since the chaincodes will be run against a fixed set of features which provide standard function calls and arguments they must have endpoints to match the calls made in these features. The structures are defined for each chaincode in the [schemas folder](./docs/schemas).