import dotenv from "dotenv";
import assert from "assert";
import { promises as fs } from "fs";

export interface Env {
    CHANNEL_NAME: string;
    CLIENT_ID: string;
    CLIENT_SECRET: string;
}

export function getEnv(): Env {
    const output = dotenv.config();

    if ("error" in output) {
        throw output.error;
    }

    assert(process.env.CHANNEL_NAME,  "CHANNEL_NAME not found in process.env");
    assert(process.env.CLIENT_ID,     "CLIENT_ID not found in process.env");
    assert(process.env.CLIENT_SECRET, "CLIENT_SECRET not found in process.env");

    const {
        CHANNEL_NAME,
        CLIENT_ID,
        CLIENT_SECRET,
    } = process.env;

    return {
        CHANNEL_NAME,
        CLIENT_ID,
        CLIENT_SECRET,
    };
}

export interface TokenData {
    "accessToken": string;
    "refreshToken": string;
    "expiryTimestamp": number|null;
}

function validateTokenData(tokenData: any): asserts tokenData is TokenData {
    assert("accessToken" in tokenData);
    assert(typeof tokenData.accessToken === "string");

    assert("refreshToken" in tokenData);
    assert(typeof tokenData.refreshToken === "string");

    assert("expiryTimestamp" in tokenData);
    assert(typeof tokenData.expiryTimestamp === "number" || tokenData.expiryTimestamp === null);
}

const TOKEN_DATA_FILE = "./tokens.json";

export async function getTokenData(): Promise<TokenData> {
    const data = await fs.readFile(TOKEN_DATA_FILE);
    const tokenData = JSON.parse(data.toString());
    validateTokenData(tokenData);
    return tokenData;
}

export async function writeTokenData(tokenData: TokenData): Promise<void> {
    validateTokenData(tokenData);
    await fs.writeFile(TOKEN_DATA_FILE, JSON.stringify(tokenData, null, 4), {
        encoding: "utf-8"
    });
}