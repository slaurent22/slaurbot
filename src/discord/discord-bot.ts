import Discord from "discord.js";
import { getEnv } from "../util/env";
import { log, LogLevel } from "../util/logger";
import { DiscordNotifier } from "./discord-notifier";


export async function createDiscordClient(): Promise<Discord.Client> {
    const client = new Discord.Client();

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    client.once("ready", async() => {
        log(LogLevel.INFO, "Discord client is ready");
        const notifier = new DiscordNotifier({
            discordClient: client,
        });

        await notifier.notifyTestChannel({
            content: "Hello slaurent I am the Discord Notifier",
        });
    });

    client.on("message", message => {
        log(LogLevel.DEBUG, `[DISCORD MSG] CHANNEL:'${message.channel.id}' CONTENT:'${message.content}'`);
        if (message.content === "!ping") {
            void message.channel.send("pong!");
        }
    });

    const {
        DISCORD_BOT_TOKEN,
    } = getEnv();

    const loginResult = await client.login(DISCORD_BOT_TOKEN);
    if (loginResult !== DISCORD_BOT_TOKEN) {
        log(LogLevel.WARN, "login return value does not match DISCORD_BOT_TOKEN");
    }

    return client;
}
