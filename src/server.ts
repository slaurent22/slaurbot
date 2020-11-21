import { init, Bot } from "./bot";
import { log, LogLevel } from "./logger";
import nodeCleanup from "node-cleanup";

async function server() {
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
        bot.chatClient.quit();
    });

}

server();