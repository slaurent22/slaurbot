import { BotCommand, BotCommandContext, BotCommandMatch, createBotCommand } from "easy-twitch-bot";
import type { ChatClient, PrivateMessage } from "twitch-chat-client";
import { log, LogLevel } from "./logger";

export interface CommandManagerConfig {
    commandPrefix: string;
    chatClient: ChatClient;
    messageCommands: Record<string, string>;
}

export class CommandManager {
    private _commandPrefix: string;
    private _chatClient: ChatClient;
    private _commands = new Map<string, BotCommand>();

    constructor({
        commandPrefix,
        chatClient,
        messageCommands
    }: CommandManagerConfig) {
        this._commandPrefix = commandPrefix;
        this._chatClient = chatClient;

        for (const [name, message] of Object.entries(messageCommands)) {
            this.addCommand(name, (param, context) => {
                context.say(message);
            });
        }
    }

    public addCommand(
        commandName: string,
        handler: (params: string[], context: BotCommandContext) => void | Promise<void>): void
    {
        const command = createBotCommand(commandName, handler);
        this._commands.set(commandName, command);
        log(LogLevel.INFO, `Command added: ${commandName}`);
    }

    // https://github.com/d-fischer/twitch/blob/master/packages/easy-twitch-bot/src/Bot.ts
    public listen(): void {
        this._chatClient.onMessage(async (channel, user, message, msg) => {
            const match = this._findMatch(msg);
            if (match === null) {
                return;
            }
            const commandContext = new BotCommandContext(this._chatClient, msg);
            try {
                log(LogLevel.INFO, "Executing command:", match.command.name);
                await match.command.execute(match.params, commandContext);
            }
            catch(e) {
                const errMsg = `${match.command.name} command failed`;
                log(LogLevel.ERROR, `${errMsg}:`, e);
                commandContext.say(errMsg);
            }
        });

        log(LogLevel.INFO, "Listening for commands");
    }

    // https://github.com/d-fischer/twitch/blob/master/packages/easy-twitch-bot/src/Bot.ts
    private _findMatch(msg: PrivateMessage): BotCommandMatch | null {
        const line = msg.params.message.trim().replace(/  +/g, " ");
        for (const command of this._commands.values()) {
            const params = command.match(line, this._commandPrefix);
            if (params !== null) {
                return {
                    command,
                    params
                };
            }
        }
        return null;
    }
}