import * as chalk from 'chalk';
import { given as tsFlowGiven, then as tsFlowThen, when as tsFlowWhen } from 'cucumber-tsflow/dist';
import { Logger } from '../utils/logger';

const logger = Logger.getLogger('./src/decorators.ts');

function addLogging(type: 'given' | 'then' | 'when', stepPattern: RegExp | string, func: MethodDecorator): MethodDecorator {
    // need to use keyword this
    // tslint:disable-next-line: only-arrow-functions
    return function(target: any, key: string, descriptor: any) {
        const orginalMethod = descriptor.value;

        descriptor.value = function(...args: any[]) {
            if (logger.level === 'debug') {
                let step = stepPattern.toString();
                step = step.substring(1, step.length - 1);

                step = step.split(/\(.*?\)/).map((el, idx, arr) => {
                    return idx < args.length && idx !== arr.length - 1 ? el + `${args[idx]}` : el;
                }).join('');

                logger.debug(chalk.yellow(`[${type}] ${step}`));
            }

            return orginalMethod.apply(this, args);
        };

        return func(target, key, descriptor);
    };
}

export function given(stepPattern: RegExp | string, tag?: string, timeout?: number): MethodDecorator {
    const func = tsFlowGiven(stepPattern, tag, timeout);
    return addLogging('given', stepPattern, func);
}

export function then(stepPattern: RegExp | string, tag?: string, timeout?: number): MethodDecorator {
    const func = tsFlowThen(stepPattern, tag, timeout);
    return addLogging('then', stepPattern, func);
}

export function when(stepPattern: RegExp | string, tag?: string, timeout?: number): MethodDecorator {
    const func = tsFlowWhen(stepPattern, tag, timeout);
    return addLogging('when', stepPattern, func);
}
