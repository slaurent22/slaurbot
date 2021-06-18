import type {
    ApiClient as TwitchApiClient,
    UserIdResolvable as TwitchUserIdResolvable
} from "twitch/lib";
import { getLogger } from "../util/logger";
import { createRedis } from "../util/redis";

export enum TwitchStreamStatus {
    OFFLINE = "OFFLINE",
    LIVE = "LIVE",
}

const TWITCH_STREAM_STATUS_KEY = "twitchStreamStatus";

const logger = getLogger({
    name: "slaurbot-twitch-stream-status-cache",
});

function isValidTwitchStreamStatus(status: string | null): status is TwitchStreamStatus {
    return status === TwitchStreamStatus.OFFLINE ||
           status === TwitchStreamStatus.LIVE;
}

export async function writeTwitchStreamStatusToCache(status: TwitchStreamStatus): Promise<void> {
    logger.debug("writeTwitchStreamStatusToCache:" + status);
    const redis = createRedis();
    const setResult = await redis.set(TWITCH_STREAM_STATUS_KEY, status);
    logger.info("writeStreamStatusToCache redis result:" + String(setResult));
    await redis.quit();
}

export async function getCachedTwitchStreamStatus(): Promise<TwitchStreamStatus> {
    const redis = createRedis();
    const status = await redis.get(TWITCH_STREAM_STATUS_KEY);
    if (!isValidTwitchStreamStatus(status)) {
        logger.error("twitchStreamStatus value is invalid: value:" + String(status));
        await redis.quit();
        return TwitchStreamStatus.OFFLINE;
    }

    await redis.quit();
    logger.debug("getCachedTwitchStreamStatus: return" + status);
    return status;
}

export async function fetchTwitchStreamUpdateCache({
    apiClient,
    userId,
}: {
    apiClient: TwitchApiClient;
    userId: TwitchUserIdResolvable;
}): Promise<TwitchStreamStatus> {
    const stream = await apiClient.helix.streams.getStreamByUserId(userId);
    const status = stream ? TwitchStreamStatus.LIVE : TwitchStreamStatus.OFFLINE;
    logger.debug("fetchTwitchStreamUpdateCache stream= " + JSON.stringify(stream));
    await writeTwitchStreamStatusToCache(status);
    return status;


}
