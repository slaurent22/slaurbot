import nodeCleanup from "node-cleanup";
import { getLogger } from "./util/logger";
import type { DiscordStreamBotConfig } from "./discord/discord-stream-bot";
import { DiscordStreamBot } from "./discord/discord-stream-bot";
import { DISCORD_CHANNEL_ID, DISCORD_GUILD_ID, DISCORD_ROLE_ID, STREAMING_MEMBERS_COOLDOWN } from "./util/constants";
import { getEnv } from "./util/env";


export async function createSheo(): Promise<void> {
    const logger = getLogger({
        name: "slaurbot-sheo",
    });

    const {
        DISCORD_SHEO_TOKEN,
    } = getEnv();

    // contact slaurent to add your server

    const DISCORD_SHEO_CONFIG = new Map<string, DiscordStreamBotConfig>();

    DISCORD_SHEO_CONFIG.set(DISCORD_GUILD_ID.SLAURCORD, {
        cooldownInterval: STREAMING_MEMBERS_COOLDOWN,
        name: "streambot-slaurcord",
        streamingMembersChannelId: DISCORD_CHANNEL_ID.STREAMING_MEMBERS,
        streamingRoleId: DISCORD_ROLE_ID.STREAMING,
    });

    DISCORD_SHEO_CONFIG.set(DISCORD_GUILD_ID.SLAURTEST, {
        cooldownInterval: 0,
        name: "slaurtest",
        streamingMembersChannelId: "855786635995774987",
        streamingRoleId: "855785447501070357",
    });

    DISCORD_SHEO_CONFIG.set(DISCORD_GUILD_ID.HKSR, {
        cooldownInterval: 100,
        name: "hksr",
        streamingRoleId: "855853020914647080",
        filter: activity => {
            const state = activity.state;
            if (!state) {
                return false;
            }
            logger.info(`state: '${state}'`);
            return state.includes("Hollow Knight");
        },
    });

    const sheo = new DiscordStreamBot(DISCORD_SHEO_TOKEN, DISCORD_SHEO_CONFIG);

    nodeCleanup(() => {
        logger.info("performing cleanup");
        void sheo.destroy();
    });

    await sheo.login();
}
