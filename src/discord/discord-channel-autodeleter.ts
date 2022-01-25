import assert from "assert";
import type { Client as DiscordClient, TextBasedChannels } from "discord.js";
import type { Logger } from "@d-fischer/logger";
import { RateLimiterMemory, RateLimiterQueue } from "rate-limiter-flexible";
import { getLogger } from "../util/logger";

interface DiscordChannelAutodeleterConfig {
    checkInterval: number;
    channelConfig: Map<string, number>;
    discordClient: DiscordClient;
}

function createRateLimiterQueue(): RateLimiterQueue {
    const limiterFlexible = new RateLimiterMemory({
        points: 2,
        duration: 1, // Per one second
    });

    return new RateLimiterQueue(limiterFlexible, {
        maxQueueSize: 200,
    });
}

export class DicordChannelAutodeleter {
    private _channelConfig: Map<string, number>;
    private _channelMap = new Map<string, TextBasedChannels>();
    private _checkInterval: number;
    private _discordClient: DiscordClient;
    private _logger: Logger;
    private _queue: RateLimiterQueue;

    constructor({
        channelConfig,
        checkInterval,
        discordClient,
    }: DiscordChannelAutodeleterConfig) {
        this._channelConfig = channelConfig;
        this._checkInterval = checkInterval;
        this._discordClient = discordClient;

        this._logger = getLogger({
            name: "slaurbot-discord-channel-autodeleter",
        });

        for (const [channelId, maxAge] of this._channelConfig.entries()) {
            this._logger.info(`Checking: channel ${channelId}, maxAge ${maxAge}`);
            const channel = this._discordClient.channels.cache.get(channelId);
            assert(channel, "Channel not found!");
            assert(channel.isText(), "Channel is not text!");
            this._channelMap.set(channelId, channel);
        }

        this._queue = createRateLimiterQueue();
    }

    public init(): void {
        this._autodeleteChannels();
        setTimeout(this._autodeleteChannels.bind(this), this._checkInterval);
    }

    private _autodeleteChannels() {
        this._logger.info("Beginning autodelete");
        [...this._channelConfig.entries()].map(async([channelId, maxAge]) => {
            this._logger.info(`[channel:${channelId}] maxAge ${maxAge}`);
            const channel = this._channelMap.get(channelId);
            assert(channel, `[channel:${channelId}] somehow missing from the map?!`);
            const messages = channel.messages;
            const messageCollection = await messages.fetch({
                limit: 100,
            });
            const messageArray = messageCollection.toJSON();
            this._logger.info(`[channel:${channelId}] checking ${messageArray.length} messages`);
            const deletionResults = await Promise.all(messageArray.map(async(message) => {
                const {
                    createdTimestamp,
                    pinned,
                } = message;

                const age = Date.now() - createdTimestamp;
                const isOld = age >= maxAge;
                const shouldDelete = isOld && !pinned;
                if (!shouldDelete) {
                    return false;
                }

                this._logger.info(`[channel:${channelId}] QUEUEING DELETE: ${message.id}`);
                await this._queue.removeTokens(1).then(async() => {
                    this._logger.info(`[channel:${channelId}] DELETING: ${message.id}`);

                    await message.delete();
                });



                return true;
            }));

            const numDeleted = deletionResults.filter(x => x).length;
            this._logger.info(`[channel:${channelId}] deleted ${numDeleted} messages`);
        });

    }
}
