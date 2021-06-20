import sourceMapSupport from "source-map-support";
import nodeCleanup from "node-cleanup";
import { Slaurbot } from "./slaurbot";
import { getLogger } from "./util/logger";
import { createExpress } from "./express";
import { createDiscordClient } from "./discord/discord-bot";
import { getTwitchTokens } from "./twitch/twitch-token-cache";
import { createSheo } from "./sheo";

sourceMapSupport.install();

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

void createSheo();
void botServer();
