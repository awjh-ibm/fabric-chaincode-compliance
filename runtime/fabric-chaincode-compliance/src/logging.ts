/**
 * SPDX-License-Identifier: Apache-2.0
 */
import * as figlet from 'figlet';
import * as logger from 'winston';

console.log(figlet.textSync('Fabric Chaincode Compliace'));

const LEVEL: string = process.env.FCC_LOG || 'info';

logger.configure({
    format: logger.format.combine(
        logger.format.colorize(),
        logger.format.simple(),
    ),
    level: LEVEL,
    transports: [
        //
        // - Write to all logs with level `info` and below to `combined.log`
        // - Write all logs error (and below) to `error.log`.
        //
        new logger.transports.Console(),
    ],
});

logger.info(`Logging enabled at ${LEVEL}  To change eg.. 'export FCC_LOG=debug' `);
