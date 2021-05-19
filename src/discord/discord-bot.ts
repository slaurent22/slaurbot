import Discord from "discord.js";
import type { Client as DiscordClient } from "discord.js";
import { getEnv } from "../util/env";
import { getLogger } from "../util/logger";
import { DISCORD_AUTODELETE_CHANNEL_CONFIG, DISCORD_AUTODELETE_CHECK_INTERVAL } from "../util/constants";
import { DiscordNotifier } from "./discord-notifier";
import { DiscordEventManager } from "./discord-event-manager";
import { DicordChannelAutodeleter } from "./discord-channel-autodeleter";

const logger = getLogger({
    name: "slaurbot-discord-bot",
});

export async function createDiscordClientImp(resolve: ((dc: DiscordClient) => void)): Promise<void> {
    const client = new Discord.Client();

    client.once("ready", async() => {
        logger.info("Discord client is ready");
        const notifier = new DiscordNotifier({
            discordClient: client,
        });

        await notifier.sendJSONToTestChannel({
            content: "Hello slaurent I am the Discord Notifier",
        });

        const eventManager = new DiscordEventManager({
            discordClient: client,
            discordNotifier: notifier,
        });

        await eventManager.listen();

        const autodeleteConfig = {
            channelConfig: DISCORD_AUTODELETE_CHANNEL_CONFIG,
            checkInterval: DISCORD_AUTODELETE_CHECK_INTERVAL,
            discordClient: client,
            discordNotifier: notifier,
        };

        const autodeleter = new DicordChannelAutodeleter(autodeleteConfig);
        autodeleter.init();

        resolve(client);
    });

    client.on("message", message => {
        // eslint-disable-next-line max-len
        logger.info(`[DISCORD MSG] USER:'${message.author.id}' CHANNEL:'${message.channel.id}' CONTENT:'${message.content}'`);
        if (message.content === "!ping") {
            void message.channel.send("pong!");
        }
    });

    client.on("messageUpdate", (oldMessage, newMessage) => {
        const userId = newMessage.author ? newMessage.author.id : "unknown";
        // eslint-disable-next-line max-len
        logger.info(`[DISCORD MSG UPDATE] USER:'${userId}' CHANNEL:'${newMessage.channel.id}' CONTENT:'${String(newMessage.content)}'`);
    });

    const {
        DISCORD_BOT_TOKEN,
    } = getEnv();

    const loginResult = await client.login(DISCORD_BOT_TOKEN);
    if (loginResult !== DISCORD_BOT_TOKEN) {
        logger.warning("login return value does not match DISCORD_BOT_TOKEN");
    }
}

export function createDiscordClient(): Promise<DiscordClient> {
    return new Promise<Discord.Client>((resolve, reject) => {
        try {
            void createDiscordClientImp(resolve);
        }
        catch (e) {
            logger.error("Failed to create Discord Client:" + String(e));
            reject(e);
        }
    });
}
