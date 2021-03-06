import type { ConnectCompatibleApp, Subscription } from "twitch-webhooks";
import { EnvPortAdapter, WebHookListener } from "twitch-webhooks";
import type { ApiClient, HelixStream } from "twitch/lib";
import type { Logger } from "@d-fischer/logger";
import { DISCORD_ROLE_ID, TWITCH_STREAM_TITLE_DIRECTIVE_NOPING, TWITCH_USER_ID } from "../util/constants";
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
    discordNotifier: DiscordNotifier;
}

function getStreamStatus(stream: HelixStream | undefined): TwitchStreamStatus {
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
    private _discordNotifier: DiscordNotifier;
    private _listener: WebHookListener;
    private _logger: Logger;

    constructor({
        apiClient,
        discordNotifier,
    }: TwitchWebHookManagerConfig) {
        this._apiClient = apiClient;
        this._discordNotifier = discordNotifier;
        const { LOG_LEVEL, } = getEnv();
        this._listener = new WebHookListener(this._apiClient, new EnvPortAdapter({
            hostName: "slaurbot.herokuapp.com",
        }), {
            logger: {
                name: "twitch-webhook-listener",
                timestamps: true,
                minLevel: LOG_LEVEL,
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
        const userId = TWITCH_USER_ID.SLAURENT;

        this._listener.applyMiddleware(app);
        await this._subscribeToStreamChanges({ userId, userName, });
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

        const subscription = await this._listener.subscribeToStreamChanges(userId, async(stream?: HelixStream) => {
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
                const channel = await this._apiClient.kraken.channels.getChannel(stream.userId);
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
                    channel,
                };
                this._logger.info(JSON.stringify(streamData));
                await this._discordNotifier.sendJSONToTestChannel(streamData);

                const noPing = stream.title.includes(TWITCH_STREAM_TITLE_DIRECTIVE_NOPING);
                if (noPing) {
                    await this._discordNotifier.notifyTestChannel({
                        content: TWITCH_STREAM_TITLE_DIRECTIVE_NOPING,
                        embed: getTwitchStreamEmbed({
                            title: stream.title,
                            gameName,
                            startDate: stream.startDate,
                            thumbnailUrl: stream.thumbnailUrl,
                            boxArtUrl: null,
                            logo: channel.logo,
                        }),
                    });
                }
                else if (wentOnline(previousStatus, currentStatus)) {
                    const pingRole = DISCORD_ROLE_ID.STREAM_PING;
                    await this._discordNotifier.notifyStreamStatusChannel({
                        content: `<@&${pingRole}> ${userName} is streaming ${gameName}!`,
                        embed: getTwitchStreamEmbed({
                            title: stream.title,
                            gameName,
                            startDate: stream.startDate,
                            thumbnailUrl: stream.thumbnailUrl,
                            boxArtUrl: game ? game.boxArtUrl : null,
                            logo: channel.logo,
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
            await this._discordNotifier.sendJSONToTestChannel(streamStatusData);
        });

        this._verifySubscription(subscription);
    }

    private _verifySubscription(subscription: Subscription) {
        const VERIFICATION_TIMEOUT_SECONDS = 60;
        setTimeout(async() => {
            const {
                id,
                verified,
            } = subscription;

            this._logger.info(`[${id}] subscription verified:${verified}`);

            const content = verified ?
                `[${id}] **INFO** subscription is verified after ${VERIFICATION_TIMEOUT_SECONDS} seconds` :
                `[${id}] **WARNING**: subscription is **UNVERIFIED** after ${VERIFICATION_TIMEOUT_SECONDS} seconds`;

            await this._discordNotifier.notifyTestChannel({
                content,
            });
        }, 1000 * VERIFICATION_TIMEOUT_SECONDS);
    }
}
