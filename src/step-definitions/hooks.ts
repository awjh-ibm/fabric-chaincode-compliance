import * as chalk from 'chalk';
import { HookScenarioResult, pickle, SourceLocation } from 'cucumber';
import { after, before, binding } from 'cucumber-tsflow/dist';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Logger } from '../utils/logger';
import { Workspace } from './utils/workspace';

const logger = Logger.getLogger('./src/step-definitions/hooks.ts');

interface HookScenario {
    sourceLocation: SourceLocation;
    pickle: pickle.Pickle;
}

@binding([Workspace])
export class Hooks {
    private feature = null;

    @before()
    public beforeScenario(scenario: HookScenario) {
        if (this.feature !== scenario.sourceLocation.uri) {
            this.feature = scenario.sourceLocation.uri;
            logger.info(chalk.yellow(`Running feature ${formatFeature(this.feature)}`));
        }
        logger.info(chalk.yellow(`Running scenario ${scenario.pickle.name}`));
    }

    @after()
    public afterScenario(scenarioResult: HookScenarioResult) {
        const prefix = `[${scenarioResult.pickle.name}]`;

        logger.info(`${prefix} Status: ${scenarioResult.result.status}`);
        logger.info(`${prefix} Duration: ${formatDuration(scenarioResult.result.duration)}`);

        if (scenarioResult.result.status === 'failed') {
            logger.error(scenarioResult.result.exception.name);
            logger.error(scenarioResult.result.exception.message);
            logger.error(scenarioResult.result.exception.stack);
        }

        logger.info(chalk.yellow(`Finished scenario ${scenarioResult.pickle.name}`));
    }
}

function formatDuration(nanoseconds: number) {
    const millseconds = nanoseconds / 1000 / 1000;

    const remainder = millseconds % (60 * 1000);
    let seconds: any = remainder / 1000;
    let mins: any = (millseconds - remainder) / (60 * 1000);

    seconds = (mins < 10) ? '0' + mins : mins;
    mins = (mins < 10) ? '0' + mins : mins;

    return mins + 'm' + seconds + 's';
}

function formatFeature(file: string) {
    let feature = 'Unknown';
    const fullPath = path.resolve(process.cwd(), file);

    try {
        const fileContents = fs.readFileSync(fullPath, 'utf-8');
        const match = /Feature: (.*)/.exec(fileContents);
        feature = match[1];
    } catch (err) {
        logger.error(`Could not get feature from file ${fullPath}`);
    }

    return feature;
}
