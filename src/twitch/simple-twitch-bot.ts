import type { ChatClient, PrivateMessage } from "twitch-chat-client";
import type { BotCommand, BotCommandMatch } from "easy-twitch-bot";
import { BotCommandContext, createBotCommand } from "easy-twitch-bot";
import type { Logger } from "@d-fischer/logger";
import { getLogger } from "../util/logger";

export interface SimpleTwitchBotConfig {
    chatClient: ChatClient;
}

export type CommandHandler = (params: string[], context: BotCommandContext) => void | Promise<void>;

export class SimpleTwitchBot {
    private _chatClient: ChatClient;
    private _commandPrefix = "";
    private _commands = new Map<string, BotCommand>();
    private _logger: Logger;

    constructor({
        chatClient,
    }: SimpleTwitchBotConfig) {
        this._chatClient = chatClient;

        this._logger = getLogger({
            name: "simple-twitch-bot",
        });
    }

    public addCommand(commandName: string, handler: CommandHandler): void {
        const command = createBotCommand(commandName, handler);
        this._commands.set(commandName, command);
        this._logger.info(`Command added: ${commandName}`);
    }

    public removeCommand(commandName: string): void {
        this._commands.delete(commandName);
        this._logger.info(`Command removed: ${commandName}`);
    }

    public listen(): void {
        // https://github.com/d-fischer/twitch/blob/master/packages/easy-twitch-bot/src/Bot.ts
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this._chatClient.onMessage(async(channel, user, message, msg) => {
            const match = this._findMatch(msg);
            if (match === null) {
                return;
            }
            const commandContext = new BotCommandContext(this._chatClient, msg);
            try {
                this._logger.info("Executing command:" + match.command.name);
                await match.command.execute(match.params, commandContext);
            }
            catch (e) {
                const errMsg = `${match.command.name} command failed`;
                this._logger.error(`${errMsg}:` + String(e));
                commandContext.say(errMsg);
            }
        });

        this._logger.info("Listening for commands");
    }

    // https://github.com/d-fischer/twitch/blob/master/packages/easy-twitch-bot/src/Bot.ts
    private _findMatch(msg: PrivateMessage): BotCommandMatch | null {
        const line = msg.params.message.trim().replace(/  +/g, " ");
        for (const command of this._commands.values()) {
            const params = command.match(line, this._commandPrefix);
            if (params !== null) {
                return {
                    command,
                    params,
                };
            }
        }
        return null;
    }
}
