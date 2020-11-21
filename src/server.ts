import { Bot } from "easy-twitch-bot/lib/Bot";
import { init } from "./bot";
import { log, LogLevel } from "./logger";

async function server() {
    let bot: Bot;
    try {
        bot = await init();
    }
    catch (e) {
        log(LogLevel.ERROR, "Bot init failed:", e);
        process.exit(1);
    }

    // DO I NEED TO DO SOMETHING LIKE THIS?

    // registerCleanup(() => {
    //     bot.chat.quit();
    // });

}

server();