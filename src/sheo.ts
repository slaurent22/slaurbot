import nodeCleanup from "node-cleanup";
import { getLogger } from "./util/logger";
import type { DiscordStreamBotConfig } from "./discord/discord-stream-bot";
import { DiscordStreamBot } from "./discord/discord-stream-bot";
import { DISCORD_CHANNEL_ID, DISCORD_GUILD_ID, DISCORD_ROLE_ID, STREAMING_MEMBERS_COOLDOWN } from "./util/constants";
import { getEnv } from "./util/env";
import { guildMemberString } from "./util/log-strings";


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
        streamingMembersChannelId: "837761461290795078",
        filter: (activity, guildMember) => {
            const mutedRole = guildMember.roles.cache.get("822719769970737152");
            if (mutedRole) {
                logger.critical(`${guildMemberString(guildMember)} is muted`);
                return false;
            }

            const sheoIgnoreRole = guildMember.roles.cache.get("868968408983683083");
            if (sheoIgnoreRole) {
                logger.critical(`${guildMemberString(guildMember)} is on sheo's ignore list`);
                return false;
            }

            const state = activity.state;
            if (!state) {
                return false;
            }
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
