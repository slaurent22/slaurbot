import dotenv from "dotenv";
import assert from "assert";

export interface Env {
    CHANNEL_NAME: string;
    OAUTH_TOKEN: string;
}

export function getEnv(): Env {
    const output = dotenv.config();

    if ("error" in output) {
        throw output.error;
    }

    assert(process.env.CHANNEL_NAME, "CHANNEL_NAME not found in process.env");
    assert(process.env.OAUTH_TOKEN,  "OAUTH_TOKEN not found in process.env");

    const {
        CHANNEL_NAME,
        OAUTH_TOKEN,
    } = process.env;

    return {
        CHANNEL_NAME,
        OAUTH_TOKEN,
    };
}