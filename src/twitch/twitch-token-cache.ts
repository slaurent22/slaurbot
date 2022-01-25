import assert from "assert";
import type { AccessToken } from "@twurple/auth";
import { createRedis } from "../util/redis";

function parseNullableInt(str: string | null): number | null {
    if (str === null) {
        return null;
    }

    const parsed = parseInt(str, 10);
    if (isNaN(parsed)) {
        return null;
    }

    return parsed;
}

function jsonParseFallback(val: string | null, fallback: unknown) {
    if (!val) {
        return fallback;
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return JSON.parse(val);
    }
    catch {
        return fallback;
    }
}

export async function getTwitchTokens(): Promise<AccessToken> {
    const redis = createRedis();
    const [
        accessToken,
        refreshToken,
        scope,
        expiresIn,
        obtainmentTimestamp
    ] = await redis.hmget("twitchTokens", "accessToken", "refreshToken", "scope", "expiresIn", "obtainmentTimestamp");
    assert(accessToken);
    const tokenData = {
        accessToken,
        refreshToken,
        scope: jsonParseFallback(scope, []) as Array<string>,
        expiresIn: parseNullableInt(expiresIn),
        obtainmentTimestamp: parseNullableInt(obtainmentTimestamp) as number,
    };
    await redis.quit();
    return tokenData;
}

export async function writeTwitchTokens(tokenData: AccessToken): Promise<void> {
    const redis = createRedis();
    await redis.hmset("twitchTokens", {
        accessToken: String(tokenData.accessToken),
        refreshToken: String(tokenData.refreshToken),
        scope: JSON.stringify(tokenData.scope),
        expiresIn: String(tokenData.expiresIn),
        obtainmentTimestamp: tokenData.obtainmentTimestamp,
    });
    await redis.quit();
}
