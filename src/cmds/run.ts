import * as cucumber from 'cucumber';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Arguments, Argv, CommandModule } from 'yargs';
import { Global } from '../interfaces/interfaces';
import { Network, NetworkType } from '../network/network';
import { addExports } from './utils';

declare const global: Global;

const cucumberArgs = [
    'features/*.feature',
    '--require-module', 'ts-node/register',
    '--require', 'src/step-definitions/**/*.ts',
];

const dockerChaincodeFolder = path.join(__dirname, '../../resources/chaincode');

const options = {
    'chaincode-dir': {
        alias: 'd',
        description: 'Directory containing the chaincodes for testing',
        required: true,
        type: 'string',
    },
    features: {
        description: 'Alternative set of feature files to use, array of globs',
        type: 'array',
    },
    language: {
        alias: 'l',
        choices: ['golang', 'java', 'node'],
        description: 'Language of chaincodes that will be used',
        required: true,
        type: 'string',
    },
    profile: {
        alias: 'p',
        default: ['default'],
        description: 'Which of the inbuilt test profiles to run',
        type: 'string',
    },
    verbose: {
        choices: ['info', 'debug'],
        default: 'info',
        description: 'Set logging level',
    },
};

const cmd: CommandModule = {
    builder: (yargs: Argv): Argv => {
        yargs.options(options);
        yargs.usage('fabric-chaincode-compliance');

        return yargs;
    },
    command: 'run [options]',
    desc: 'Run the compliance tests',
    handler: (args: Arguments): Arguments => {
        const chaincodeFolder = path.resolve(process.cwd(), args.chaincodeDir);

        global.CHAINCODE_LANGUAGE = args.language;

        const network = new Network(NetworkType.SINGLE_ORG);
        global.CURRENT_NETWORK = network;

        const cli = new (cucumber as any).Cli({
            // TODO WE WILL NEED TO HANDLE NETWORKS WITH PRIVATE DATA STORES ETC
            argv: process.argv.slice(0, 2).concat(cucumberArgs),
            cwd: process.cwd(),
            stdout: process.stdout,
        });

        return args.thePromise = new Promise(async (resolve, reject) => {
            try {
                await fs.copy(chaincodeFolder, dockerChaincodeFolder);
                await network.build();
            } catch (err) {
                reject(err);
            }

            const resp = await cli.run();

            // await network.teardown();
            // await fs.emptyDir(dockerChaincodeFolder);
            // await fs.ensureFile(path.join(dockerChaincodeFolder, '.gitkeep'));

            if (!resp.success) {
                reject(new Error('Cucumber tests failed'));
            }

            resolve();
        });
    },
};

addExports(exports, cmd);
