import assert from "assert";
import { createRedis } from "../util/redis";

interface TokenData {
    "accessToken": string;
    "refreshToken": string;
    "expiryTimestamp": number|null;
}

function parseNullableInt(str: string|null): number|null {
    return str === null ? str : parseInt(str, 10);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateTokenData(tokenData: Record<string, any>): asserts tokenData is TokenData {
    assert("accessToken" in tokenData);
    assert(typeof tokenData.accessToken === "string");

    assert("refreshToken" in tokenData);
    assert(typeof tokenData.refreshToken === "string");

    assert("expiryTimestamp" in tokenData);
    assert(typeof tokenData.expiryTimestamp === "number" || tokenData.expiryTimestamp === null);
}

export async function getTwitchTokens(): Promise<TokenData> {
    const redis = createRedis();
    const [
        accessToken,
        refreshToken,
        expiryTimestamp
    ] = await redis.hmget("twitchTokens", "accessToken", "refreshToken", "expiryTimestamp");
    const tokenData = {
        accessToken,
        refreshToken,
        expiryTimestamp: parseNullableInt(expiryTimestamp),
    };
    validateTokenData(tokenData);
    await redis.quit();
    return tokenData;
}

export async function writeTwitchTokens(tokenData: TokenData): Promise<void> {
    const redis = createRedis();
    validateTokenData(tokenData);
    await redis.hmset("twitchTokens", {
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        expiryTimestamp: String(tokenData.expiryTimestamp),
    });
    await redis.quit();
}
