import sourceMapSupport from "source-map-support";
import nodeCleanup from "node-cleanup";
import { Slaurbot } from "./slaurbot";
import { getLogger } from "./util/logger";
import { createDiscordClient } from "./discord/discord-bot";
import { getTwitchTokens } from "./twitch/twitch-token-cache";

sourceMapSupport.install();


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

    await slaurbot.start();

    nodeCleanup(() => {
        logger.info("slaurbot: Performing cleanup");
        slaurbot.destroy();
    });

}

void botServer();
