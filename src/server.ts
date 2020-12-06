import nodeCleanup from "node-cleanup";
import type { Client as DiscordClient } from "discord.js";
import type { TwitchBot } from "./twitch/slaurbot";
import { init } from "./twitch/slaurbot";
import { log, LogLevel } from "./util/logger";
import { createExpress } from "./express";
import { createDiscordClient } from "./discord/discord-bot";

const PORT = process.env.PORT || 5000;

async function botServer() {
    let bot: TwitchBot|undefined;
    let discordClient: DiscordClient;

    try {
        discordClient = await createDiscordClient();
    }
    catch (e) {
        log(LogLevel.ERROR, "createDiscordClient failed:", e);
        process.exit(1);
    }

    try {
        const app = createExpress();
        app.listen(PORT, () => log(LogLevel.INFO, `Express app listening on ${ PORT }`));
        bot = await init(app, discordClient);
    }
    catch (e) {
        log(LogLevel.ERROR, "Bot init failed:", e);
        process.exit(1);
    }

    nodeCleanup(() => {
        log(LogLevel.INFO, "Performing cleanup");
        if (discordClient) {
            discordClient.destroy();
        }
        if (bot) {
            void bot.chatClient.quit();
        }
    });

}

// webServer();
void botServer();
