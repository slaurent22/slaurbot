import Discord from "discord.js";
import { getEnv } from "../util/env";
import { getLogger } from "../util/logger";
import { DiscordNotifier } from "./discord-notifier";

const logger = getLogger({
    name: "slaurbot-discord-bot",
});

export async function createDiscordClient(): Promise<Discord.Client> {
    const client = new Discord.Client();

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    client.once("ready", async() => {
        logger.info("Discord client is ready");
        const notifier = new DiscordNotifier({
            discordClient: client,
        });

        await notifier.notifyTestChannel({
            content: "Hello slaurent I am the Discord Notifier",
        });
    });

    client.on("message", message => {
        logger.debug(`[DISCORD MSG] CHANNEL:'${message.channel.id}' CONTENT:'${message.content}'`);
        if (message.content === "!ping") {
            void message.channel.send("pong!");
        }
    });

    const {
        DISCORD_BOT_TOKEN,
    } = getEnv();

    const loginResult = await client.login(DISCORD_BOT_TOKEN);
    if (loginResult !== DISCORD_BOT_TOKEN) {
        logger.warning("login return value does not match DISCORD_BOT_TOKEN");
    }

    return client;
}
