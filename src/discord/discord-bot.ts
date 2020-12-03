import Discord from "discord.js";
import { DISCORD_CHANNEL_ID } from "../util/constants";
import { getEnv } from "../util/env";
import { log, LogLevel } from "../util/logger";


export async function createDiscordClient(): Promise<Discord.Client> {
    const client = new Discord.Client();

    client.once("ready", () => {
        log(LogLevel.INFO, "Discord client is ready");
        const testChannel = client.channels.cache.get(DISCORD_CHANNEL_ID.TEST);
        if (testChannel && testChannel.isText()) {
            void testChannel.send("Discord client is up and running!");
        }
        else {
            log(LogLevel.ERROR, "Could not find #test channel");
        }

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
