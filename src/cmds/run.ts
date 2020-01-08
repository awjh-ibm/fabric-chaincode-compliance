import * as cucumber from 'cucumber';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Arguments, Argv, CommandModule } from 'yargs';
import { Global } from '../interfaces/interfaces';
import { DEFINED_NETWORKS, Network } from '../network/network';
import { Logger } from '../utils/logger';
import { addExports } from './utils';

declare const global: Global;

const cucumberArgs = [
    'features/*.feature',
    '--require-module', 'ts-node/register',
    '--require', 'src/step-definitions/**/*.ts',
];

const dockerChaincodeFolder = path.join(__dirname, '../../resources/chaincode');
const logger = Logger.getLogger('./src/cmds/run.ts');

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
    'logging-level': {
        choices: ['info', 'debug'],
        default: 'info',
        description: 'Set logging level',
    },
    profile: {
        alias: 'p',
        default: ['default'],
        description: 'Which of the inbuilt test profiles to run',
        type: 'string',
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
        global.LOGGING_LEVEL = args.loggingLevel;

        return args.thePromise = new Promise(async (resolve, reject) => {
            const cucumberErrors = [];

            for (const name of DEFINED_NETWORKS) {
                const network = new Network(name);
                global.CURRENT_NETWORK = network;

                logger.info(`Creating network ${name}`);

                try {
                    await fs.copy(chaincodeFolder, dockerChaincodeFolder);
                    await network.build();
                } catch (err) {
                    reject(err);
                }

                const argv = process.argv.slice(0, 2).concat(cucumberArgs).concat('--tag', '@' + name);

                const cli = new (cucumber as any).Cli({
                    argv,
                    cwd: process.cwd(),
                    stdout: process.stdout,
                });

                logger.info('Running cucumber tests');

                const requireKeys = Object.keys(require.cache);

                requireKeys.forEach((key) => {
                    if (key.includes('cucumber-tsflow') || key.includes('step-definitions')) {
                        delete require.cache[require.resolve(key)];
                    }
                });

                const resp = await cli.run();

                logger.info(`Tearing down network ${name}`);

                await network.teardown();
                await fs.emptyDir(dockerChaincodeFolder);
                await fs.ensureFile(path.join(dockerChaincodeFolder, '.gitkeep'));

                if (!resp.success) {
                    cucumberErrors.push(name);
                }
            }

            if (cucumberErrors.length > 0) {
                reject(new Error('Cucumber tests failed for networks: ' + cucumberErrors.join('\n')));
            }

            resolve();
        });
    },
};

addExports(exports, cmd);
