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
        SHEO_READ_ONLY,
    } = getEnv();

    // contact slaurent to add your server

    const DISCORD_SHEO_CONFIG = new Map<string, DiscordStreamBotConfig>();

    DISCORD_SHEO_CONFIG.set(DISCORD_GUILD_ID.SLAURCORD, {
        cooldownInterval: STREAMING_MEMBERS_COOLDOWN,
        name: "streambot-slaurcord",
        streamingMembersChannelId: DISCORD_CHANNEL_ID.STREAMING_MEMBERS,
        streamingRoleId: DISCORD_ROLE_ID.STREAMING,
        filter: (activity, guildMember) => {
            const sheoIgnoreRole = guildMember.roles.cache.get("1047282292831289414");
            if (sheoIgnoreRole) {
                logger.crit(`${guildMemberString(guildMember)} is on sheo's ignore list`);
                return false;
            }
            return true;
        },
        modRole: "763945762815344650",
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
                logger.crit(`${guildMemberString(guildMember)} is muted`);
                return false;
            }

            const sheoIgnoreRole = guildMember.roles.cache.get("868968408983683083");
            if (sheoIgnoreRole) {
                logger.crit(`${guildMemberString(guildMember)} is on sheo's ignore list`);
                return false;
            }

            const state = activity.state;
            if (!state) {
                return false;
            }
            return state.includes("Hollow Knight");
        },
        modRole: "772974621166141441",
    });

    DISCORD_SHEO_CONFIG.set(DISCORD_GUILD_ID.HISPANO, {
        cooldownInterval: 100,
        name: "hispano",
        streamingRoleId: "947153797254377522",
        streamingMembersChannelId: "947153445763285007",
        filter: (activity) => {
            const state = activity.state;
            if (!state) {
                return false;
            }
            return state.includes("Hollow Knight");
        },
        modRole: "870713690838691861",
    });

    DISCORD_SHEO_CONFIG.set(DISCORD_GUILD_ID.HKPTBR, {
        cooldownInterval: 100,
        name: "hkptbr",
        streamingRoleId: "1359603945802305777",
        streamingMembersChannelId: "1354067755095031810",
        filter: (activity, guildMember) => {
            const sheoIgnoreRole = guildMember.roles.cache.get("1359610562803400774");
            if (sheoIgnoreRole) {
                logger.crit(`${guildMemberString(guildMember)} is on sheo's ignore list`);
                return false;
            }
            const state = activity.state;
            if (!state) {
                return false;
            }
            return state.includes("Hollow Knight");
        },
        modRole: "1353841903535263830",
    });

    const sheo = new DiscordStreamBot(DISCORD_SHEO_TOKEN, DISCORD_SHEO_CONFIG, SHEO_READ_ONLY);

    nodeCleanup(() => {
        logger.info("performing cleanup");
        void sheo.destroy();
    });

    await sheo.login();
}
