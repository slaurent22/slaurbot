import { Bot, createBotCommand } from "easy-twitch-bot";
import { getEnv } from "./env";
import { log, LogLevel } from "./logger";


function createBot(): Promise<Bot> {
    log(LogLevel.INFO, "Creating bot");
    const env = getEnv();
    if (env === null) {
        throw new Error("Local environment not found");
    }

    return Bot.create({
        auth: env.OAUTH_TOKEN,
        channel: env.CHANNEL_NAME,
        commands: [
            createBotCommand("!dice", (params, { user, say }) => {
                const diceRoll = Math.floor(Math.random() * 6) + 1;
                say(`@${user} rolled a ${diceRoll}`);
            })
        ]
    });
}

function logMsg(msg: string|undefined) {
    log(LogLevel.INFO, `[MSG] ${msg}`);
}

export async function init(): Promise<Bot> {
    const bot = await createBot();
    log(LogLevel.INFO, "Bot created");

    const chatClient = bot.chat;
    // const apiClient = bot.api;

    chatClient.onAnyMessage(msg => {
        logMsg(msg.rawLine);
    });

    await chatClient.connect();

    chatClient.onMessage(async (channel: string, user: string, message: string, msg) => {
        log(LogLevel.INFO, {
            channel, user, message, msg
        });

        if (message === "!ping") {
            chatClient.say(channel, "pong");
        }
    });

    // later, when you don't need this command anymore:
    // chatClient.removeListener(followAgeListener);

    return bot;
}

