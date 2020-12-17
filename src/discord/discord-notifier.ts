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
    private _streamingMembersChannel?: DiscordChannel;
    private _streamStatusChannel?: DiscordChannel;
    private _testChannel?: DiscordChannel;

    constructor({
        discordClient,
    }: DiscordNotifierConfig) {
        this._discordClient = discordClient;
        this._logger = getLogger({
            name: "slaurbot-discord-notifier",
        });

        this._streamingMembersChannel = this._discordClient.channels.cache.get(DISCORD_CHANNEL_ID.STREAMING_MEMBERS);
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

    public async notifyStreamingMembersChannel(message: MessageConfig): Promise<void> {
        if (this._streamingMembersChannel && this._streamingMembersChannel.isText()) {
            await this._streamingMembersChannel.send(message);
        }
        else {
            this._logger.error("DiscordNotifier: Streaming Members Channel not found");
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

    public async sendJSONToTestChannel<T>(obj: T): Promise<void> {
        const stringified = JSON.stringify(obj, null, 4);
        const content = "```\n" + stringified + "\n```";
        await this.notifyTestChannel({ content, });
    }


}
