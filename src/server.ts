import nodeCleanup from "node-cleanup";
import type { Bot } from "./bot";
import { init } from "./bot";
import { log, LogLevel } from "./logger";
import { createExpress } from "./express";

const PORT = process.env.PORT || 5000;

async function botServer() {
    let bot: Bot|undefined;
    try {
        const app = createExpress();
        app.listen(PORT, () => log(LogLevel.INFO, `Listening on ${ PORT }`));
        bot = await init(app);
    }
    catch (e) {
        log(LogLevel.ERROR, "Bot init failed:", e);
        process.exit(1);
    }

    nodeCleanup(() => {
        log(LogLevel.INFO, "Performing cleanup");
        if (bot) {
            void bot.chatClient.quit();
        }
    });

}

// webServer();
void botServer();
