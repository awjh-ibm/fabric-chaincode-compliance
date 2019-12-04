import { CommandModule } from 'yargs';

export function addExports(exports, command: CommandModule) {
    for (const key in command) {
        if (command.hasOwnProperty(key)) {
            exports[key] = command[key];
        }
    }
}
