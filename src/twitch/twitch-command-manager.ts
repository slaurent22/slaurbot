import type { ChatClient } from "twitch-chat-client";
import type { ApiClient } from "twitch/lib";
import humanizeDuration from "humanize-duration";
import type { Logger } from "@d-fischer/logger";
import type { Uwuifier } from "uwuifier";
import { getLogger } from "../util/logger";
import { TWITCH_CHARACTER_LIMIT, TWITCH_USER_ID, ZOTE_PRECEPTS } from "../util/constants";
import type { DiscordReader } from "../discord/discord-reader";
import { getPretzelNowPlaying, getTwitchBttvEmotes, getTwitchFfzEmotes } from "../util/rest-api";
import { getEnv } from "../util/env";
import { SimpleTwitchBot } from "./simple-twitch-bot";
import { getCachedTwitchStreamStatus } from "./twitch-stream-status-cache";

export interface TwitchCommandManagerConfig {
    apiClient: ApiClient;
    chatClient: ChatClient;
    discordReader: DiscordReader;
    uwuifier: Uwuifier;
}

function getRandomInt(max: number): number {
    return Math.floor(Math.random() * Math.floor(max));
}

function durationInEnglish(duration: number): string {
    return humanizeDuration(duration, {
        units: ["y", "mo", "w", "d", "h", "m"],
        round: true,
    });
}

export class TwitchCommandManager {
    private _apiClient: ApiClient;
    private _chatClient: ChatClient;
    private _discordReader: DiscordReader;
    private _logger: Logger;
    private _simpleTwitchBot: SimpleTwitchBot;
    private _uwuifier: Uwuifier;

    constructor({
        apiClient,
        chatClient,
        discordReader,
        uwuifier,
    }: TwitchCommandManagerConfig) {
        this._apiClient = apiClient;
        this._chatClient = chatClient;
        this._discordReader = discordReader;
        this._uwuifier = uwuifier;

        this._logger = getLogger({
            name: "slaurbot-twitch-command-manager",
        });

        const {
            COMMAND_PREFIX,
        } = getEnv();

        this._simpleTwitchBot = new SimpleTwitchBot({
            chatClient: this._chatClient,
            commandPrefix: COMMAND_PREFIX,
        });

        this.initCommands();
    }

    public async listen(): Promise<void> {
        await this._refreshMessageCommandsFromDataStore();
        this._simpleTwitchBot.listen();
    }

    private initCommands(): void {

        this._simpleTwitchBot.addCommand("!ping", (params, context) => {
            context.say("pong!");
        });

        this._simpleTwitchBot.addCommand("!followage", async(params, context) => {
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

        this._simpleTwitchBot.addCommand("TPFufun", (params, context) => {
            const edThoone = context.msg.userInfo.userId === TWITCH_USER_ID.EDTHOONE;

            if (edThoone) {
                context.say("TPFufun");
            }
        });

        this._simpleTwitchBot.addCommand("!bttv", async(params, context) => {
            context.say(await getTwitchBttvEmotes());
        });

        this._simpleTwitchBot.addCommand("!ffz", async(params, context) => {
            context.say(await getTwitchFfzEmotes());
        });

        this._simpleTwitchBot.addCommand("!song", async(params, context) => {
            context.say(await getPretzelNowPlaying());
        });

        this._simpleTwitchBot.addCommand("!precept", (params, context) => {
            this._logger.info("!precept params:" + params.join(" "));
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
        }, {
            cooldown: {
                time: 3000,
                reply: true,
            },
        });

        this._simpleTwitchBot.addCommand("!so", async(params, context) => {
            const callingUser = context.msg.userInfo;
            const userDisplayName = callingUser.displayName;
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

        }, {
            cooldown: {
                time: 1000,
                reply: true,
            },
            permissions: {
                broadcaster: true,
                founder: false,
                mod: true,
                subscriber: false,
                vip: true,
            },
        });

        this._simpleTwitchBot.addCommand("!uptime", async(params, context) => {
            const cachedStatus = await getCachedTwitchStreamStatus();
            if (cachedStatus === "OFFLINE") {
                context.say("Stream is offline");
                return;
            }

            const stream = await this._apiClient.helix.streams.getStreamByUserName(TWITCH_USER_ID.SLAURENT);
            if (!stream) {
                context.say("Stream is live, but I failed to fetch stream data :(");
                return;
            }

            const duration = new Date().getTime() - stream.startDate.getTime();
            const durationEnglish = durationInEnglish(duration);
            context.say(`Stream has been live for ${durationEnglish}`);
        }, {
            cooldown: {
                time: 1000,
                reply: false,
            },
        });

        this._simpleTwitchBot.addCommand("!refreshCommands", async(params, context) => {
            await this._refreshMessageCommandsFromDataStore();
            context.say("Successfully refreshed commands!");
        }, {
            permissions: {
                broadcaster: true,
                founder: false,
                mod: true,
                subscriber: false,
                vip: false,
            },
        });

        this._simpleTwitchBot.addCommand("!uwuify", (params, context) => {
            const user = context.msg.userInfo;
            const userDisplayName = user.displayName;
            if (params.length === 0) {
                context.say(`@${userDisplayName} give me something t-to uwuify, siwwy *looks at you*`);
                return;
            }
            const sentence = params.join(" ").trim();
            this._logger.info("!uwuify sentence:" + sentence);
            let response = this._uwuifier.uwuifySentence(sentence).trim();
            this._logger.info("!uwuify result:" + response);
            this._logger.info("!uwuify result length:" + String(response.length));

            if (response.length > TWITCH_CHARACTER_LIMIT) {
                // eslint-disable-next-line max-len
                context.say(`@${userDisplayName} the uwuified result exceeds the Twitch character limit of ${TWITCH_CHARACTER_LIMIT}; I'll post as much as I can.`);
                response = response.slice(0, TWITCH_CHARACTER_LIMIT - 1);
            }

            const isSame = sentence === response;
            if (isSame) {
                context.say("uwuified was same as original, sowwy");
            }
            else {
                context.say(response);
            }
        }, {
            cooldown: {
                time: 3000,
                reply: true,
            },
        });

    }

    private async _refreshMessageCommandsFromDataStore() {
        this._logger.info("Refreshing commands...");

        const commands = await this._discordReader.readTwitchCommands();
        for (const c of commands) {
            const { command, enabled, message, } = c;
            if (enabled) {
                this._simpleTwitchBot.addCommand(command, (_params, _context) => {
                    _context.say(message);
                });
            }
            else {
                this._simpleTwitchBot.removeCommand(command);
            }
        }

        this._logger.info("Commands refreshed!");
    }
}
