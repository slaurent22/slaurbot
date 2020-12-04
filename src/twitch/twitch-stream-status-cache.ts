import type {
    ApiClient as TwitchApiClient,
    UserIdResolvable as TwitchUserIdResolvable
} from "twitch/lib";
import { log, LogLevel } from "../util/logger";
import { createRedis } from "../util/redis";

export enum TwitchStreamStatus {
    OFFLINE = "OFFLINE",
    LIVE = "LIVE",
}

const TWITCH_STREAM_STATUS_KEY = "twitchStreamStatus";

function isValidTwitchStreamStatus(status: string|null): status is TwitchStreamStatus {
    return status === TwitchStreamStatus.OFFLINE ||
           status === TwitchStreamStatus.LIVE;
}

export async function writeTwitchStreamStatusToCache(status: TwitchStreamStatus): Promise<void> {
    log(LogLevel.DEBUG, "writeTwitchStreamStatusToCache:", status);
    const redis = createRedis();
    const setResult = await redis.set(TWITCH_STREAM_STATUS_KEY, status);
    log(LogLevel.INFO, "writeStreamStatusToCache redis result:", setResult);
    await redis.quit();
}

export async function getCachedTwitchStreamStatus(): Promise<TwitchStreamStatus> {
    const redis = createRedis();
    const status = await redis.get(TWITCH_STREAM_STATUS_KEY);
    if (!isValidTwitchStreamStatus(status)) {
        log(LogLevel.ERROR, "twitchStreamStatus value is invalid: value:", status);
        await redis.quit();
        return TwitchStreamStatus.OFFLINE;
    }

    await redis.quit();
    log(LogLevel.DEBUG, "getCachedTwitchStreamStatus: return", status);
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
    log(LogLevel.DEBUG, "fetchTwitchStreamUpdateCache: stream=", stream);
    await writeTwitchStreamStatusToCache(status);
    return status;


}


