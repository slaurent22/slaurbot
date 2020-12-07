import nodeCleanup from "node-cleanup";
import { Slaurbot } from "./twitch/slaurbot";
import { getLogger } from "./util/logger";
import { createExpress } from "./express";
import { createDiscordClient } from "./discord/discord-bot";
import { getTwitchTokens } from "./twitch/twitch-token-cache";

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

    const app = createExpress();
    app.listen(PORT, () => logger.info(`Express app listening on ${ PORT }`));
    await slaurbot.start(app);

    nodeCleanup(() => {
        logger.info("Performing cleanup");
        slaurbot.destroy();
    });

}

// webServer();
void botServer();
