import nodeCleanup from "node-cleanup";
import type { Client as DiscordClient } from "discord.js";
import type { TwitchBotConfig } from "./twitch/slaurbot";
import { Slaurbot } from "./twitch/slaurbot";
import { log, LogLevel } from "./util/logger";
import { createExpress } from "./express";
import { createDiscordClient } from "./discord/discord-bot";
import { getTwitchTokens } from "./twitch/twitch-token-cache";

const PORT = process.env.PORT || 5000;

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
    app.listen(PORT, () => log(LogLevel.INFO, `Express app listening on ${ PORT }`));
    await slaurbot.start(app);

    nodeCleanup(() => {
        log(LogLevel.INFO, "Performing cleanup");
        slaurbot.destroy();
    });

}

// webServer();
void botServer();
