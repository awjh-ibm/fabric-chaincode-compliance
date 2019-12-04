#!/usr/bin/env node

import * as fs from 'fs-extra';
import * as path from 'path';
import * as yargs from 'yargs';

const modulePath =  path.join(__dirname, '..');

const packageJSON = fs.readJSONSync(path.join(modulePath, 'package.json'));
const version = 'v' + packageJSON.version;

try {
    // tslint:disable-next-line: no-unused-expression
    const results = yargs
    .commandDir(path.join(__dirname, 'cmds'), {exclude: /.*\.spec\.js/})
    .demandCommand(1, 'You need to specify a command')
    .showHelpOnFail(true)
    .help()
    .wrap(null)
    .alias('v', 'version')
    .version(version)
    .describe('v', 'show version information')
    .env('FABRIC_COMPLIANCE')
    .epilog('Thank for your compliance')
    .strict()
    .argv;

    results.thePromise.then((resp) => {
        console.log('Command succeeded');
        process.exit(0);
    }).catch((err) => {
        console.error(err.message);
        error();
    });
} catch (err) {
    console.error(err.message);
    error();
}

function error() {
    console.error('Command failed');
    process.exit(1);
}
