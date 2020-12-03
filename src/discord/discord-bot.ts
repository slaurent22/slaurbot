import Discord from "discord.js";
import { getEnv } from "../util/env";
import { log, LogLevel } from "../util/logger";

export async function createDiscordClient(): Promise<Discord.Client> {
    const client = new Discord.Client();

    client.once("ready", () => {
        log(LogLevel.INFO, "discord client is ready");
    });

    client.on("message", message => {
        if (message.content === "!ping") {
            void message.channel.send("pong!");
        }
        log(LogLevel.DEBUG, "discord message: ", message.content);
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
