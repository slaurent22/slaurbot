import type { ChatClient } from "twitch-chat-client/lib";
import type { ConnectCompatibleApp } from "twitch-webhooks";
import { EnvPortAdapter, WebHookListener } from "twitch-webhooks";
import type { ApiClient, HelixStream } from "twitch/lib";
import type { Channel as DiscordChannel, Client as DiscordClient } from "discord.js";
import { DISCORD_CHANNEL_ID, USER_ID } from "../util/constants";
import { getEnv } from "../util/env";
import { log, LogLevel } from "../util/logger";
import { getTwitchStreamEmbed } from "../discord/discord-embed";

export interface TwitchWebHookManagerConfig {
    apiClient: ApiClient;
    chatClient: ChatClient;
    discordClient: DiscordClient;
}

export class TwitchWebHookManager {
    private _apiClient: ApiClient;
    private _chatClient: ChatClient;
    private _discordClient: DiscordClient;
    private _listener: WebHookListener;

    constructor({
        apiClient,
        chatClient,
        discordClient,
    }: TwitchWebHookManagerConfig) {
        this._apiClient = apiClient;
        this._chatClient = chatClient;
        this._discordClient = discordClient;
        this._listener = new WebHookListener(this._apiClient, new EnvPortAdapter({
            hostName: "slaurbot.herokuapp.com",
        }), {
            logger: {
                name: "SLAURBOT",
                timestamps: true,
                minLevel: "DEBUG",
                colors: false,
            },
        });
    }

    public async listen(app: ConnectCompatibleApp): Promise<void> {
        const {
            TWITCH_CHANNEL_NAME: userName,
        } = getEnv();
        const userId = USER_ID.SLAURENT;

        this._listener.applyMiddleware(app);
        await Promise.all([
            this._subscribeToStreamChanges({ userId, userName, }),
            this._subscribeToFollowsToUser({ userId, userName, })
        ]);
    }

    private getDiscordStreamStatusChannel(): DiscordChannel|undefined {
        return this._discordClient.channels.cache.get(DISCORD_CHANNEL_ID.STREAM_STATUS);
    }


    private async _subscribeToStreamChanges({
        userId, userName,
    }: {
        userId: string; userName: string;
    }): Promise<void> {
        const discordChannel = this.getDiscordStreamStatusChannel();
        // TODO: STORE PREVIOUS STREAM IN REDIS CACHE
        let prevStream = await this._apiClient.helix.streams.getStreamByUserId(userId);
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        await this._listener.subscribeToStreamChanges(userId, async(stream?: HelixStream) => {
            // TODO: REORGANIZE ALL OF THIS DISGUSTING MESS
            log(LogLevel.INFO, "Stream Change:", stream);
            if (stream && !prevStream) {
                if (!prevStream) {
                    const game = await stream.getGame();
                    const gameName = game ? game.name : "<unknown game>";
                    const gameId = game ? game.id : "<unknown id>";
                    const {
                        userDisplayName,
                        startDate,
                    } = stream;
                    log(LogLevel.INFO, {
                        userDisplayName,
                        userId,
                        startDate,
                        gameName,
                        gameId,
                    });
                    if (discordChannel && discordChannel.isText()) {
                        await discordChannel.send({
                            content: `@everyone ${userName} went live!`,
                            embed: getTwitchStreamEmbed({
                                title: stream.title,
                                gameName,
                                startDate,
                            }),
                        });
                    }
                }
            }
            else {
                // no stream, no display name
                if (discordChannel && discordChannel.isText()) {
                    await discordChannel.send(`${userName} just went offline`);
                }
            }
            prevStream = stream ? stream : null;
        });
    }

    private async _subscribeToFollowsToUser({
        userId, userName,
    }: {
        userId: string;
        userName: string;
    }): Promise<void> {
        await this._listener.subscribeToFollowsToUser(userId, (follow) => {
            log(LogLevel.INFO, "Follow:", follow);
            this._chatClient.say(userName, `@${follow.userDisplayName} thank you for the follow!`);
        });
    }
}
