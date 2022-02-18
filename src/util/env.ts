import assert from "assert";
import { LogLevel } from "@d-fischer/logger";

export interface Env {
    TWITCH_CHANNEL_NAME: string;
    TWITCH_CLIENT_ID: string;
    TWITCH_CLIENT_SECRET: string;
    REDIS_TLS_URL: string;
    REDIS_URL: string;
    DISCORD_BOT_TOKEN: string;
    UWU_PERCENT: number;
    COMMAND_PREFIX: string;
    LOG_LEVEL: LogLevel;
    DISCORD_SHEO_TOKEN: string;
    SHEO_READ_ONLY: boolean;
    TWITCH_EVENTSUB_SECRET: string;
}

let ENV_CACHE: Readonly<Env> | undefined;

function assertIsString(val: unknown, message: string): asserts val is string {
    assert(typeof val === "string", message);
}

function getLogLevelEnum(logLevel: string): LogLevel {
    switch (logLevel) {
        case "TRACE":
        case "DEBUG":
        case "INFO":
        case "WARNING":
        case "ERROR":
        case "CRITICAL":
            return LogLevel[logLevel];
        default: throw new Error(`Unknown log level: '${logLevel}'`);
    }
}

function getEnvImpl(): Readonly<Env> {
    assertIsString(process.env.TWITCH_CHANNEL_NAME,  "TWITCH_CHANNEL_NAME not found in process.env");
    assertIsString(process.env.TWITCH_CLIENT_ID,     "TWITCH_CLIENT_ID not found in process.env");
    assertIsString(process.env.TWITCH_CLIENT_SECRET, "TWITCH_CLIENT_SECRET not found in process.env");
    assertIsString(process.env.REDIS_TLS_URL,        "REDIS_TLS_URL not found in process.env");
    assertIsString(process.env.REDIS_URL,            "REDIS_URL not found in process.env");
    assertIsString(process.env.DISCORD_BOT_TOKEN,    "DISCORD_BOT_TOKEN not found in process.env");
    assertIsString(process.env.UWU_PERCENT,          "UWU_PERCENT not found in process.env");
    assertIsString(process.env.COMMAND_PREFIX,       "COMMAND_PREFIX not found in process.env");
    assertIsString(process.env.LOG_LEVEL,            "LOG_LEVEL not found in process.env");
    assertIsString(process.env.DISCORD_SHEO_TOKEN,   "DISCORD_SHEO_TOKEN not found in process.env");
    assertIsString(process.env.SHEO_READ_ONLY,       "SHEO_READ_ONLY not found in process.env");
    assertIsString(process.env.TWITCH_EVENTSUB_SECRET, "TWITCH_EVENTSUB_SECRET not found in process.env");

    const {
        TWITCH_CHANNEL_NAME,
        TWITCH_CLIENT_ID,
        TWITCH_CLIENT_SECRET,
        REDIS_TLS_URL,
        REDIS_URL,
        DISCORD_BOT_TOKEN,
        UWU_PERCENT,
        COMMAND_PREFIX,
        LOG_LEVEL,
        DISCORD_SHEO_TOKEN,
        SHEO_READ_ONLY,
        TWITCH_EVENTSUB_SECRET,
    } = process.env;

    const UWU_PERCENT_PARSED = parseInt(UWU_PERCENT, 10);
    assert(!isNaN(UWU_PERCENT_PARSED), "Expected a numeric UWU_PERCENT, received " + UWU_PERCENT);

    const env = Object.freeze({
        TWITCH_CHANNEL_NAME,
        TWITCH_CLIENT_ID,
        TWITCH_CLIENT_SECRET,
        REDIS_TLS_URL,
        REDIS_URL,
        DISCORD_BOT_TOKEN,
        UWU_PERCENT: UWU_PERCENT_PARSED,
        COMMAND_PREFIX,
        LOG_LEVEL: getLogLevelEnum(LOG_LEVEL),
        DISCORD_SHEO_TOKEN,
        SHEO_READ_ONLY: SHEO_READ_ONLY === "true",
        TWITCH_EVENTSUB_SECRET,
    });

    console.log({
        TWITCH_CHANNEL_NAME,
        COMMAND_PREFIX,
        LOG_LEVEL,
    });

    return env;
}

export function getEnv(): Readonly<Env> {
    if (ENV_CACHE) {
        return ENV_CACHE;
    }

    ENV_CACHE = getEnvImpl();
    return ENV_CACHE;
}
