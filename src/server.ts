import nodeCleanup from "node-cleanup";
import type { Bot } from "./bot";
import { init } from "./bot";
import { log, LogLevel } from "./logger";
// import webServer from "./index";

async function botServer() {
    let bot: Bot;
    try {
        bot = await init();
    }
    catch (e) {
        log(LogLevel.ERROR, "Bot init failed:", e);
        process.exit(1);
    }

    nodeCleanup(() => {
        log(LogLevel.INFO, "Performing cleanup");
        void bot.chatClient.quit();
    });

}

// webServer();
void botServer();
