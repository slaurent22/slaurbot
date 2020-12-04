import assert from "assert";

export interface Env {
    TWITCH_CHANNEL_NAME: string;
    TWITCH_CLIENT_ID: string;
    TWITCH_CLIENT_SECRET: string;
    REDIS_TLS_URL: string;
    REDIS_URL: string;
    DISCORD_BOT_TOKEN: string;
}

export function getEnv(): Readonly<Env> {
    assert(process.env.TWITCH_CHANNEL_NAME,  "TWITCH_CHANNEL_NAME not found in process.env");
    assert(process.env.TWITCH_CLIENT_ID,     "TWITCH_CLIENT_ID not found in process.env");
    assert(process.env.TWITCH_CLIENT_SECRET, "TWITCH_CLIENT_SECRET not found in process.env");
    assert(process.env.REDIS_TLS_URL,        "REDIS_TLS_URL not found in process.env");
    assert(process.env.REDIS_URL,            "REDIS_URL not found in process.env");
    assert(process.env.DISCORD_BOT_TOKEN,    "DISCORD_BOT_TOKEN not found in process.env");

    const {
        TWITCH_CHANNEL_NAME,
        TWITCH_CLIENT_ID,
        TWITCH_CLIENT_SECRET,
        REDIS_TLS_URL,
        REDIS_URL,
        DISCORD_BOT_TOKEN,
    } = process.env;

    return Object.freeze({
        TWITCH_CHANNEL_NAME,
        TWITCH_CLIENT_ID,
        TWITCH_CLIENT_SECRET,
        REDIS_TLS_URL,
        REDIS_URL,
        DISCORD_BOT_TOKEN,
    });
}
