import nodeCleanup from "node-cleanup";
import { Slaurbot } from "./slaurbot";
import { getLogger } from "./util/logger";
import { createExpress } from "./express";
import { createDiscordClient } from "./discord/discord-bot";
import { getTwitchTokens } from "./twitch/twitch-token-cache";
import type { DiscordStreamBotConfig } from "./discord/discord-stream-bot";
import { DiscordStreamBot } from "./discord/discord-stream-bot";
import { DISCORD_CHANNEL_ID, DISCORD_GUILD_ID, DISCORD_ROLE_ID, STREAMING_MEMBERS_COOLDOWN } from "./util/constants";
import { getEnv } from "./util/env";

const PORT = process.env.PORT || 5000;

const logger = getLogger({
    name: "slaurbot-server",
});

async function botServer() {
    const [
        discordClient,
        twitchTokens
    ] = await Promise.all([
        createDiscordClient(),
        getTwitchTokens()
    ]);

    const slaurbot = new Slaurbot({
        discordClient,
        tokenData: twitchTokens,
    });

    const app = createExpress(getLogger({
        name: "slaurbot-express",
    }));
    app.listen(PORT, () => logger.info(`Express app listening on ${ PORT }`));
    await slaurbot.start(app);

    nodeCleanup(() => {
        logger.info("slaurbot: Performing cleanup");
        slaurbot.destroy();
    });

}

async function discordStreamBots() {
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

    const sheo = new DiscordStreamBot(DISCORD_SHEO_TOKEN, DISCORD_SHEO_CONFIG);

    nodeCleanup(() => {
        logger.info("discordStreamBots: Performing cleanup");
        sheo.destroy();
    });

    await sheo.login();
}

void discordStreamBots();
void botServer();
