import type { Logger } from "@d-fischer/logger";
import type { Client as DiscordClient, Channel as DiscordChannel, MessageEmbed } from "discord.js";
import { DISCORD_CHANNEL_ID } from "../util/constants";
import { getLogger } from "../util/logger";

interface DiscordNotifierConfig {
    discordClient: DiscordClient;
}

interface MessageConfig {
    content: string;
    embed?: MessageEmbed;
}

export class DiscordNotifier {
    private _discordClient: DiscordClient;
    private _logger: Logger;
    private _streamStatusChannel?: DiscordChannel;
    private _testChannel?: DiscordChannel;


    constructor({
        discordClient,
    }: DiscordNotifierConfig) {
        this._discordClient = discordClient;
        this._logger = getLogger({
            name: "slaurbot-discord-notifier",
        });

        this._streamStatusChannel = this._discordClient.channels.cache.get(DISCORD_CHANNEL_ID.STREAM_STATUS);
        this._testChannel = this._discordClient.channels.cache.get(DISCORD_CHANNEL_ID.TEST);
    }

    public async notifyStreamStatusChannel(message: MessageConfig): Promise<void> {
        if (this._streamStatusChannel && this._streamStatusChannel.isText()) {
            await this._streamStatusChannel.send(message);
        }
        else {
            this._logger.error("DiscordNotifier: Stream Status Channel not found");
        }
    }

    public async notifyTestChannel(message: MessageConfig): Promise<void> {
        if (this._testChannel && this._testChannel.isText()) {
            await this._testChannel.send(message);
        }
        else {
            this._logger.error("DiscordNotifier: Test Channel not found");
        }
    }


}
