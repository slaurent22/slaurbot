import Discord from "discord.js";
import type { Client as DiscordClient } from "discord.js";
import { getEnv } from "../util/env";
import { getLogger } from "../util/logger";
import {
    DISCORD_CLIENT_INTENTS
} from "../util/constants";

const logger = getLogger({
    name: "slaurbot-discord-bot",
});

export async function createDiscordClientImp(resolve: ((dc: DiscordClient) => void)): Promise<void> {
    const client = new Discord.Client({
        intents: DISCORD_CLIENT_INTENTS,
    });

    client.once("ready", () => {
        logger.info("Discord client is ready");
        resolve(client);
    });

    const {
        DISCORD_BOT_TOKEN,
    } = getEnv();

    const loginResult = await client.login(DISCORD_BOT_TOKEN);
    if (loginResult !== DISCORD_BOT_TOKEN) {
        logger.warn("login return value does not match DISCORD_BOT_TOKEN");
    }
}

export function createDiscordClient(): Promise<DiscordClient> {
    return new Promise<Discord.Client>((resolve, reject) => {
        try {
            void createDiscordClientImp(resolve);
        }
        catch (e) {
            logger.error("Failed to create Discord Client:" + String(e));
            reject(e);
        }
    });
}
