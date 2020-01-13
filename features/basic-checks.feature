@single-org
Feature: BasicChecks

    Scenario: I can install and instantiate a simple chaincode
        Given Channel "mychannel" has been created using the profile "channel"
        And All peers on channel "mychannel" have installed the chaincode "simple"
        And Organisation "Org1" has registered the identity "user1"
        And Organisation "Org1" has instantiated the chaincode "simple" on channel "mychannel"

    Scenario: Gets a string response
        Then Expecting result "Hello World" organisation "Org1" evaluates against the chaincode "simple" the transaction "HelloWorld" on channel "mychannel" as "user1"

    Scenario: Call with a string
        Then Expecting result "Ping" organisation "Org1" evaluates against the chaincode "simple" the transaction "CallAndResponse" on channel "mychannel" as "user1" with args:
            | Ping |

    Scenario: Put a key value pair to the world state
        When Organisation "Org1" submits against the chaincode "simple" the transaction "PutState" on channel "mychannel" as "user1" with args:
            | KEY_1 | VALUE_1 |
        Then The world state for the chaincode "simple" on channel "mychannel" should contain "VALUE_1" for key "KEY_1"

    Scenario: Read a key value pair from the world state
        Then Expecting result "VALUE_1" organisation "Org1" evaluates against the chaincode "simple" the transaction "GetState" on channel "mychannel" as "user1" with args:
            | KEY_1 |

    Scenario: Delete a key from the world state
        When Organisation "Org1" submits against the chaincode "simple" the transaction "DeleteState" on channel "mychannel" as "user1" with args:
            | KEY_1 |
        Then The world state for the chaincode "simple" on channel "mychannel" should not have key "KEY_1"