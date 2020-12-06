import type { Client as DiscordClient, Channel as DiscordChannel } from "discord.js";
import { DISCORD_CHANNEL_ID } from "../util/constants";
import { log, LogLevel } from "../util/logger";

interface DiscordNotifierConfig {
    discordClient: DiscordClient;
}

export class DiscordNotifier {
    private _discordClient: DiscordClient;
    private _streamStatusChannel?: DiscordChannel;
    private _testChannel?: DiscordChannel;


    constructor({
        discordClient,
    }: DiscordNotifierConfig) {
        this._discordClient = discordClient;

        this._streamStatusChannel = this._discordClient.channels.cache.get(DISCORD_CHANNEL_ID.STREAM_STATUS);
        this._testChannel = this._discordClient.channels.cache.get(DISCORD_CHANNEL_ID.TEST);
    }

    public async notifyStreamStatusChannel(): Promise<void> {
        if (this._streamStatusChannel && this._streamStatusChannel.isText()) {
            await this._streamStatusChannel.send("notifyStreamStatusChannel");
        }
        else {
            log(LogLevel.ERROR, "DiscordNotifier: Test Channel not found");
        }
    }

    public async notifyTestChannel(content: string): Promise<void> {
        if (this._testChannel && this._testChannel.isText()) {
            await this._testChannel.send(content);
        }
        else {
            log(LogLevel.ERROR, "DiscordNotifier: Test Channel not found");
        }
    }


}
