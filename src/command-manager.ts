import { BotCommand, BotCommandContext, BotCommandMatch, createBotCommand } from "easy-twitch-bot";
import type { ChatClient, PrivateMessage } from "twitch-chat-client";
import { ApiClient } from "twitch/lib";
import { log, LogLevel } from "./logger";
import humanizeDuration from "humanize-duration";
import { MESSAGE_COMMANDS, USER_ID } from "./constants";

export interface CommandManagerConfig {
    apiClient: ApiClient;
    chatClient: ChatClient;
}

export class CommandManager {
    private _apiClient: ApiClient;
    private _commandPrefix: string;
    private _chatClient: ChatClient;
    private _commands = new Map<string, BotCommand>();

    constructor({
        apiClient,
        chatClient,
    }: CommandManagerConfig) {
        this._apiClient = apiClient;
        this._chatClient = chatClient;

        for (const [name, message] of Object.entries(MESSAGE_COMMANDS)) {
            this._addCommand(name, (param, context) => {
                context.say(message);
            });
        }

        this._commandPrefix = "";

        this._addCommand("!followage", async (params, context) => {
            const follow = await this._apiClient.kraken.users
                .getFollowedChannel(
                    context.msg.userInfo.userId as string,
                    context.msg.channelId as string);

            if (follow) {
                const followDate = follow.followDate;
                const duration = (new Date()).getTime() - followDate.getTime();
                const humanized = humanizeDuration(duration, {
                    units: ["y", "mo", "w", "d", "h", "m"],
                    round: true
                });
                context.say(`@${context.user} You have been following for ${humanized}`);
            } else {
                context.say(`@${context.user} You are not following!`);
            }
        });

        this._addCommand("TPFufun", async (params, context) => {
            const edThoone = context.msg.userInfo.userId === USER_ID.EDTHOONE;

            if (edThoone) {
                context.say("TPFufun");
            }
        });
    }

    private _addCommand(
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