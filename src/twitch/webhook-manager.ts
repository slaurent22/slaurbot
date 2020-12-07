import type { ChatClient } from "twitch-chat-client/lib";
import type { ConnectCompatibleApp } from "twitch-webhooks";
import { EnvPortAdapter, WebHookListener } from "twitch-webhooks";
import type { ApiClient, HelixStream } from "twitch/lib";
import type { Logger } from "@d-fischer/logger";
import { USER_ID } from "../util/constants";
import { getEnv } from "../util/env";
import { getLogger } from "../util/logger";
import { getTwitchOfflineEmbed, getTwitchStreamEmbed } from "../discord/discord-embed";
import type { DiscordNotifier } from "../discord/discord-notifier";
import {
    fetchTwitchStreamUpdateCache,
    getCachedTwitchStreamStatus,
    TwitchStreamStatus,
    writeTwitchStreamStatusToCache
} from "./twitch-stream-status-cache";

export interface TwitchWebHookManagerConfig {
    apiClient: ApiClient;
    chatClient: ChatClient;
    discordNotifier: DiscordNotifier;
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
    private _discordNotifier: DiscordNotifier;
    private _listener: WebHookListener;
    private _logger: Logger;

    constructor({
        apiClient,
        chatClient,
        discordNotifier,
    }: TwitchWebHookManagerConfig) {
        this._apiClient = apiClient;
        this._chatClient = chatClient;
        this._discordNotifier = discordNotifier;
        this._listener = new WebHookListener(this._apiClient, new EnvPortAdapter({
            hostName: "slaurbot.herokuapp.com",
        }), {
            logger: {
                name: "twitch-webhook-listener",
                timestamps: true,
                minLevel: "DEBUG",
                colors: false,
            },
        });
        this._logger = getLogger({
            name: "slaurbot-twitch-webhook-manager",
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

    private async _subscribeToStreamChanges({
        userId, userName,
    }: {
        userId: string; userName: string;
    }): Promise<void> {
        const initialStatus = await fetchTwitchStreamUpdateCache({
            apiClient: this._apiClient,
            userId,
        });

        this._logger.info("Initial stream status:" + initialStatus);

        await this._discordNotifier.notifyTestChannel({
            content: "Initial stream status: `" + initialStatus + "`",
        });

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        await this._listener.subscribeToStreamChanges(userId, async(stream?: HelixStream) => {
            this._logger.info("Stream Change:" + JSON.stringify(stream));
            const previousStatus = await getCachedTwitchStreamStatus();
            const currentStatus = getStreamStatus(stream);
            const streamStatusData = {
                previousStatus,
                currentStatus,
                becameLive: wentOnline(previousStatus, currentStatus),
                becameOffline: wentOffline(previousStatus, currentStatus),
            };
            this._logger.info(JSON.stringify(streamStatusData));
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
                this._logger.info(JSON.stringify(streamData));
                await this._discordNotifier.notifyTestChannel({
                    content: "```\n" + JSON.stringify(streamData, null, 4) + "```",
                });

                if (wentOnline(previousStatus, currentStatus)) {
                    await this._discordNotifier.notifyStreamStatusChannel({
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
            else if (wentOffline(previousStatus, currentStatus)) {
                await this._discordNotifier.notifyStreamStatusChannel({
                    content: `${userName} went offline`,
                    embed: getTwitchOfflineEmbed({
                        startDate: new Date(),
                    }),
                });
            }
            await writeTwitchStreamStatusToCache(currentStatus);
            await this._discordNotifier.notifyTestChannel({
                content: "```\n" + JSON.stringify(streamStatusData, null, 4) + "```",
            });
        });
    }

    private async _subscribeToFollowsToUser({
        userId, userName,
    }: {
        userId: string;
        userName: string;
    }): Promise<void> {
        await this._listener.subscribeToFollowsToUser(userId, (follow) => {
            this._logger.info("Follow:" + JSON.stringify(follow));
            this._chatClient.say(userName, `@${follow.userDisplayName} thank you for the follow!`);
        });
    }
}
