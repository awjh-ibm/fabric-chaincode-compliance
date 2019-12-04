# hello world feature
Feature: HelloWorld

    Background:
        Given Channel "mychannel" has been created using the profile "channel"
        And All peers on channel "mychannel" have installed the chaincode "crud"
        And Organisation "Org1" has registered the identity "user1" with attributes:
            | name        | value |
            | crud.CREATE | true  |
        And Organisation "Org1" has instantiated the chaincode "crud" on channel "mychannel"
    
    Scenario: Do something
        When Organisation "Org1" submits against the chaincode "crud" the transaction "Create" on channel "mychannel" as "user1" with args:
            | somekey | somevalue |
        Then Expecting result "somevalue" organisation "Org1" evaluates against the chaincode "crud" the transaction "Read" on channel "mychannel" as "user1" with args:
            | somekey |