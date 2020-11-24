import assert from "assert";
import { createRedis } from "./redis";

export interface Env {
    CHANNEL_NAME: string;
    CLIENT_ID: string;
    CLIENT_SECRET: string;
    REDIS_TLS_URL: string;
    REDIS_URL: string;
}

export function getEnv(): Readonly<Env> {
    assert(process.env.CHANNEL_NAME,  "CHANNEL_NAME not found in process.env");
    assert(process.env.CLIENT_ID,     "CLIENT_ID not found in process.env");
    assert(process.env.CLIENT_SECRET, "CLIENT_SECRET not found in process.env");
    assert(process.env.REDIS_TLS_URL, "REDIS_TLS_URL not found in process.env");
    assert(process.env.REDIS_URL,     "REDIS_URL not found in process.env");

    const {
        CHANNEL_NAME,
        CLIENT_ID,
        CLIENT_SECRET,
        REDIS_TLS_URL,
        REDIS_URL,
    } = process.env;

    return Object.freeze({
        CHANNEL_NAME,
        CLIENT_ID,
        CLIENT_SECRET,
        REDIS_TLS_URL,
        REDIS_URL,
    });
}

export interface TokenData {
    "accessToken": string;
    "refreshToken": string;
    "expiryTimestamp": number|null;
}

function parseNullableInt(str: string|null): number|null {
    return str === null ? str : parseInt(str, 10);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateTokenData(tokenData: any): asserts tokenData is TokenData {
    assert("accessToken" in tokenData);
    assert(typeof tokenData.accessToken === "string");

    assert("refreshToken" in tokenData);
    assert(typeof tokenData.refreshToken === "string");

    assert("expiryTimestamp" in tokenData);
    assert(typeof tokenData.expiryTimestamp === "number" || tokenData.expiryTimestamp === null);
}

export async function getTokenData(): Promise<TokenData> {
    const redis = createRedis();
    const [
        accessToken,
        refreshToken,
        expiryTimestamp
    ] = await redis.hmget("twitchTokens", "accessToken", "refreshToken", "expiryTimestamp");
    const tokenData = {
        accessToken,
        refreshToken,
        expiryTimestamp: parseNullableInt(expiryTimestamp)
    };
    validateTokenData(tokenData);
    await redis.quit();
    return tokenData;
}

export async function writeTokenData(tokenData: TokenData): Promise<void> {
    const redis = createRedis();
    validateTokenData(tokenData);
    await redis.hmset("twitchTokens", {
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        expiryTimestamp: String(tokenData.expiryTimestamp)
    });
    await redis.quit();
}