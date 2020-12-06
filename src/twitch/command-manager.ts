import type { BotCommand, BotCommandMatch } from "easy-twitch-bot";
import { BotCommandContext, createBotCommand } from "easy-twitch-bot";
import type { ChatClient, PrivateMessage } from "twitch-chat-client";
import type { ApiClient } from "twitch/lib";
import humanizeDuration from "humanize-duration";
import { log, LogLevel } from "../util/logger";
import { MESSAGE_COMMANDS, USER_ID, ZOTE_PRECEPTS } from "../util/constants";
import { getTwitchBttvEmotes, getTwitchFfzEmotes } from "./rest-api";

export interface TwitchCommandManagerConfig {
    apiClient: ApiClient;
    chatClient: ChatClient;
}

function getRandomInt(max: number): number {
    return Math.floor(Math.random() * Math.floor(max));
}

export class TwitchCommandManager {
    private _apiClient: ApiClient;
    private _commandPrefix: string;
    private _chatClient: ChatClient;
    private _commands = new Map<string, BotCommand>();

    constructor({
        apiClient,
        chatClient,
    }: TwitchCommandManagerConfig) {
        this._apiClient = apiClient;
        this._chatClient = chatClient;

        for (const [name, message ] of Object.entries(MESSAGE_COMMANDS)) {
            this._addCommand(name, (param, context) => {
                context.say(message);
            });
        }

        this._commandPrefix = "";

        this._addCommand("!followage", async(params, context) => {
            const follow = await this._apiClient.kraken.users
                .getFollowedChannel(
                    context.msg.userInfo.userId as string,
                    context.msg.channelId as string);

            if (follow) {
                const followDate = follow.followDate;
                const duration = new Date().getTime() - followDate.getTime();
                const humanized = humanizeDuration(duration, {
                    units: ["y", "mo", "w", "d", "h", "m"],
                    round: true,
                });
                context.say(`@${context.user} You have been following for ${humanized}`);
            }
            else {
                context.say(`@${context.user} You are not following!`);
            }
        });

        this._addCommand("TPFufun", (params, context) => {
            const edThoone = context.msg.userInfo.userId === USER_ID.EDTHOONE;

            if (edThoone) {
                context.say("TPFufun");
            }
        });

        this._addCommand("!bttv", async(params, context) => {
            context.say(await getTwitchBttvEmotes());
        });

        this._addCommand("!ffz", async(params, context) => {
            context.say(await getTwitchFfzEmotes());
        });

        this._addCommand("!precept", (params, context) => {
            log(LogLevel.INFO, "!precept params:", params);
            let preceptNum = parseInt(params[0], 10);
            let precept = ZOTE_PRECEPTS.get(preceptNum);
            if (isNaN(preceptNum) || !precept) {
                preceptNum = 1 + getRandomInt(ZOTE_PRECEPTS.size - 1);
                precept = ZOTE_PRECEPTS.get(preceptNum);
            }
            if (!precept) {
                precept = "Precept: 'Do Not Break Slaurbot'. He is very busy and doesn't appreciate being abused.";
            }
            precept = precept.replace(/<page>/g, " ");

            context.say(precept);
        });
    }

    // https://github.com/d-fischer/twitch/blob/master/packages/easy-twitch-bot/src/Bot.ts
    public listen(): void {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this._chatClient.onMessage(async(channel, user, message, msg) => {
            const match = this._findMatch(msg);
            if (match === null) {
                return;
            }
            const commandContext = new BotCommandContext(this._chatClient, msg);
            try {
                log(LogLevel.INFO, "Executing command:", match.command.name);
                await match.command.execute(match.params, commandContext);
            }
            catch (e) {
                const errMsg = `${match.command.name} command failed`;
                log(LogLevel.ERROR, `${errMsg}:`, e);
                commandContext.say(errMsg);
            }
        });

        log(LogLevel.INFO, "Listening for commands");
    }

    private _addCommand(
        commandName: string,
        handler: (params: string[], context: BotCommandContext) => void | Promise<void>):
    void {
        const command = createBotCommand(commandName, handler);
        this._commands.set(commandName, command);
        log(LogLevel.INFO, `Command added: ${commandName}`);
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
