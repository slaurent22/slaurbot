import type { BotCommand, BotCommandMatch } from "easy-twitch-bot";
import { BotCommandContext, createBotCommand } from "easy-twitch-bot";
import type { ChatClient, PrivateMessage } from "twitch-chat-client";
import type { ApiClient } from "twitch/lib";
import humanizeDuration from "humanize-duration";
import type { Logger } from "@d-fischer/logger";
import { getLogger } from "../util/logger";
import { TWITCH_USER_ID, ZOTE_PRECEPTS } from "../util/constants";
import type { DiscordReader } from "../discord/discord-reader";
import { getPretzelNowPlaying, getTwitchBttvEmotes, getTwitchFfzEmotes } from "../util/rest-api";

export interface TwitchCommandManagerConfig {
    apiClient: ApiClient;
    chatClient: ChatClient;
    discordReader: DiscordReader;
}

function getRandomInt(max: number): number {
    return Math.floor(Math.random() * Math.floor(max));
}

const LAST_USED = {
    precept: new Date(),
};

function refreshed(lastUse: Date, cooldownMs: number) {
    return Number(new Date()) - Number(lastUse) > cooldownMs;
}

function durationInEnglish(duration: number): string {
    return humanizeDuration(duration, {
        units: ["y", "mo", "w", "d", "h", "m"],
        round: true,
    });
}

export class TwitchCommandManager {
    private _apiClient: ApiClient;
    private _commandPrefix: string;
    private _chatClient: ChatClient;
    private _discordReader: DiscordReader;
    private _commands = new Map<string, BotCommand>();
    private _logger: Logger;

    constructor({
        apiClient,
        chatClient,
        discordReader,
    }: TwitchCommandManagerConfig) {
        this._apiClient = apiClient;
        this._chatClient = chatClient;
        this._discordReader = discordReader;

        this._logger = getLogger({
            name: "slaurbot-twitch-command-manager",
        });

        this._commandPrefix = "";

        this._addCommand("!ping", (params, context) => {
            context.say("pong!");
        });

        this._addCommand("!followage", async(params, context) => {
            const follow = await this._apiClient.kraken.users
                .getFollowedChannel(
                    context.msg.userInfo.userId as string,
                    context.msg.channelId as string);

            if (follow) {
                const followDate = follow.followDate;
                const duration = new Date().getTime() - followDate.getTime();
                const durationEnglish = durationInEnglish(duration);
                context.say(`@${context.user} You have been following for ${durationEnglish}`);
            }
            else {
                context.say(`@${context.user} You are not following!`);
            }
        });

        this._addCommand("TPFufun", (params, context) => {
            const edThoone = context.msg.userInfo.userId === TWITCH_USER_ID.EDTHOONE;

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

        this._addCommand("!song", async(params, context) => {
            context.say(await getPretzelNowPlaying());
        });

        this._addCommand("!precept", (params, context) => {
            if (!refreshed(LAST_USED.precept, 3000)) {
                this._logger.info("!precept is on cooldown. Ignoring.");
                return;
            }
            LAST_USED.precept = new Date();
            this._logger.info("!precept params:" + [params].join(" "));
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

        this._addCommand("!so", async(params, context) => {
            const callingUser = context.msg.userInfo;
            const userDisplayName = callingUser.displayName;
            const isAllowed = callingUser.isMod || callingUser.isVip || callingUser.isBroadcaster;
            if (!isAllowed) {
                context.say(`@${userDisplayName} command is restricted to Mods, VIPs, and the Broadcaster`);
                return;
            }

            if (params.length === 0) {
                context.say(`@${userDisplayName} try shouting out a user or channel`);
                return;
            }

            let shoutoutTarget = params[0];
            if (shoutoutTarget.startsWith("@")) {
                shoutoutTarget = shoutoutTarget.substr(1);
            }

            let shoutoutUser;

            try {
                shoutoutUser = await this._apiClient.helix.users.getUserByName(shoutoutTarget);
            }
            catch (e) {
                this._logger.error(JSON.stringify(e));
                context.say(`@${userDisplayName}, I encountered an error looking up '${shoutoutTarget}'`);
                return;
            }

            if (!shoutoutUser) {
                context.say(`@${userDisplayName}, I could not find user '${shoutoutTarget}'`);
                return;
            }

            let msg = `Go checkout @${shoutoutUser.displayName} over at https://twitch.tv/${shoutoutUser.name}`;

            const channel = await this._apiClient.helix.channels.getChannelInfo(shoutoutUser.id);

            if (channel && channel.gameName) {
                msg += ` , they were last streaming ${channel.gameName}!`;
            }
            else {
                msg += " !";
            }

            context.say(msg);

        });

        this._addCommand("!uptime", async(params, context) => {
            const stream = await this._apiClient.helix.streams.getStreamByUserName(TWITCH_USER_ID.SLAURENT);
            if (!stream) {
                context.say("Stream is offline");
                return;
            }

            const duration = new Date().getTime() - stream.startDate.getTime();
            const durationEnglish = durationInEnglish(duration);
            context.say(`Stream has been live for ${durationEnglish}`);
        });

        this._addCommand("!refreshCommands", async(params, context) => {
            const callingUser = context.msg.userInfo;
            const isAllowed = callingUser.isMod || callingUser.isBroadcaster;
            if (!isAllowed) {
                this._logger.warn("!refreshCommands: caller not allowed. ignoring.");
                return;
            }
            await this._refreshCommands();
            context.say("Successfully refreshed commands!");
        });
    }

    public async listen(): Promise<void> {
        await this._refreshCommands();

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

    private async _refreshCommands() {
        this._logger.info("Refreshing commands...");

        const commands = await this._discordReader.readTwitchCommands();
        for (const c of commands) {
            const { command, enabled, message, } = c;
            if (enabled) {
                this._addCommand(command, (_params, _context) => {
                    _context.say(message);
                });
            }
            else {
                this._removeCommand(command);
            }
        }

        this._logger.info("Commands refreshed!");
    }

    private _addCommand(
        commandName: string,
        handler: (params: string[], context: BotCommandContext) => void | Promise<void>):
    void {
        const command = createBotCommand(commandName, handler);
        this._commands.set(commandName, command);
        this._logger.info(`Command added: ${commandName}`);
    }

    private _removeCommand(commandName: string) {
        this._commands.delete(commandName);
        this._logger.info(`Command removed: ${commandName}`);
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
