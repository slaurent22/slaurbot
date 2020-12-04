import type { ChatClient } from "twitch-chat-client/lib";
import type { ConnectCompatibleApp } from "twitch-webhooks";
import { EnvPortAdapter, WebHookListener } from "twitch-webhooks";
import type { ApiClient, HelixStream } from "twitch/lib";
import type { Channel as DiscordChannel, Client as DiscordClient } from "discord.js";
import { DISCORD_CHANNEL_ID, USER_ID } from "../util/constants";
import { getEnv } from "../util/env";
import { log, LogLevel } from "../util/logger";
import { getTwitchOfflineEmbed, getTwitchStreamEmbed } from "../discord/discord-embed";
import {
    fetchTwitchStreamUpdateCache,
    getCachedTwitchStreamStatus,
    TwitchStreamStatus,
    writeTwitchStreamStatusToCache
} from "./twitch-stream-status-cache";

export interface TwitchWebHookManagerConfig {
    apiClient: ApiClient;
    chatClient: ChatClient;
    discordClient: DiscordClient;
}

function getStreamStatus(stream: HelixStream|undefined): TwitchStreamStatus {
    return stream ? TwitchStreamStatus.LIVE : TwitchStreamStatus.OFFLINE;
}

function wentOnline(previouStatus: TwitchStreamStatus, currentStatus: TwitchStreamStatus): boolean {
    return previouStatus === TwitchStreamStatus.OFFLINE &&
           currentStatus === TwitchStreamStatus.LIVE;
}

function wentOffline(previousStatus: TwitchStreamStatus, currentStatus: TwitchStreamStatus): boolean {
    return previousStatus === TwitchStreamStatus.LIVE &&
           currentStatus === TwitchStreamStatus.OFFLINE;
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

    private getDiscordDevStatusChannel(): DiscordChannel|undefined {
        return this._discordClient.channels.cache.get(DISCORD_CHANNEL_ID.TEST);
    }


    private async _subscribeToStreamChanges({
        userId, userName,
    }: {
        userId: string; userName: string;
    }): Promise<void> {
        const discordChannel = this.getDiscordStreamStatusChannel();
        const devDiscordChannel = this.getDiscordDevStatusChannel();
        const initialStatus = await fetchTwitchStreamUpdateCache({
            apiClient: this._apiClient,
            userId,
        });
        if (devDiscordChannel && devDiscordChannel.isText()) {
            await devDiscordChannel.send("Initial stream status: `" + initialStatus + "`");
        }
        log(LogLevel.INFO, "Initial stream status:", initialStatus);
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        await this._listener.subscribeToStreamChanges(userId, async(stream?: HelixStream) => {
            log(LogLevel.INFO, "Stream Change:", stream);
            const previousStatus = await getCachedTwitchStreamStatus();
            const currentStatus = getStreamStatus(stream);
            const streamStatusData = {
                previousStatus,
                currentStatus,
                becameLive: wentOnline(previousStatus, currentStatus),
                becameOffline: wentOffline(previousStatus, currentStatus),
            };
            log(LogLevel.INFO, streamStatusData);
            if (stream) {
                const game = await stream.getGame();
                const gameName = game ? game.name : "<unknown game>";
                const streamData = {
                    id: stream.id,
                    userId: stream.userId,
                    userDisplayName: stream.userDisplayName,
                    gameId: stream.gameId,
                    type: stream.type,
                    title: stream.title,
                    viewers: stream.viewers,
                    startDate: stream.startDate,
                    language: stream.language,
                    thumbnailUrl: stream.thumbnailUrl,
                    tagIds: stream.tagIds,
                    game: {
                        id: game ? game.id : "<unknown id>",
                        name: gameName,
                        boxArtUrl: game ? game.boxArtUrl : "<unknown url>",
                    },
                };
                log(LogLevel.INFO, streamData);
                if (devDiscordChannel && devDiscordChannel.isText()) {
                    await devDiscordChannel.send(JSON.stringify(streamData, null, 4));
                }
                if (wentOnline(previousStatus, currentStatus)) {
                    if (discordChannel && discordChannel.isText()) {
                        await discordChannel.send({
                            content: `@everyone ${userName} went live!`,
                            embed: getTwitchStreamEmbed({
                                title: stream.title,
                                gameName,
                                startDate: stream.startDate,
                                thumbnailUrl: stream.thumbnailUrl,
                                boxArtUrl: game ? game.boxArtUrl : null,
                            }),
                        });
                    }
                }
            }
            else if (wentOffline(previousStatus, currentStatus)) {
                // no stream, no display name
                if (discordChannel && discordChannel.isText()) {
                    await discordChannel.send({
                        content: `${userName} went offline`,
                        embed: getTwitchOfflineEmbed({
                            startDate: new Date(),
                        }),
                    });
                }
            }
            await writeTwitchStreamStatusToCache(currentStatus);
            if (devDiscordChannel && devDiscordChannel.isText()) {
                await devDiscordChannel.send("```\n" + JSON.stringify(streamStatusData, null, 4) + "```");
            }
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
