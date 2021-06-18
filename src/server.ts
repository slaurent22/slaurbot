import nodeCleanup from "node-cleanup";
import { Slaurbot } from "./slaurbot";
import { getLogger } from "./util/logger";
import { createExpress } from "./express";
import { createDiscordClient } from "./discord/discord-bot";
import { getTwitchTokens } from "./twitch/twitch-token-cache";
import { DiscordStreamBot } from "./discord/discord-stream-bot";
import { DISCORD_CHANNEL_ID, DISCORD_ROLE_ID, STREAMING_MEMBERS_COOLDOWN } from "./util/constants";
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
        DISCORD_BOT_TOKEN,
    } = getEnv();
    const slaurcord = new DiscordStreamBot({
        botToken: DISCORD_BOT_TOKEN,
        cooldownInterval: STREAMING_MEMBERS_COOLDOWN,
        name: "streambot-slaurcord",
        streamingMembersChannelId: DISCORD_CHANNEL_ID.STREAMING_MEMBERS,
        streamingRoleId: DISCORD_ROLE_ID.STREAMING,
    });

    nodeCleanup(() => {
        logger.info("discordStreamBots: Performing cleanup");
        slaurcord.destroy();
    });

    await Promise.all([
        slaurcord.login()
        // hksrDiscord.login() :eyes_emoji:
    ]);
}

void discordStreamBots();
void botServer();
