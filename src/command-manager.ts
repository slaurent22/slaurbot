import { BotCommand, BotCommandContext, BotCommandMatch, createBotCommand } from "easy-twitch-bot";
import { ChatClient, PrivateMessage } from "twitch-chat-client";

export interface CommandManagerConfig {
    commandPrefix: string;
    chatClient: ChatClient;
}

export class CommandManager {
    private _commandPrefix: string;
    private _chatClient: ChatClient;
    private _commands = new Map<string, BotCommand>();

    constructor({
        commandPrefix,
        chatClient,
    }: CommandManagerConfig) {
        this._commandPrefix = commandPrefix;
        this._chatClient = chatClient;
    }

    public addCommand(
        commandName: string,
        handler: (params: string[], context: BotCommandContext) => void | Promise<void>): void
    {
        const command = createBotCommand(commandName, handler);
        this._commands.set(commandName, command);
    }

    // https://github.com/d-fischer/twitch/blob/master/packages/easy-twitch-bot/src/Bot.ts
    public listen(): void {
        this._chatClient.onMessage(async (channel, user, message, msg) => {
            const match = this._findMatch(msg);
            if (match !== null) {
                await match.command.execute(match.params, new BotCommandContext(this._chatClient, msg));
            }
        });
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