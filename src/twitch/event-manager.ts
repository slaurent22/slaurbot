import type { ChatClient } from "twitch-chat-client/lib";
import type { ConnectCompatibleApp } from "twitch-webhooks/lib";
import type { ApiClient } from "twitch/lib";
import type { Client as DiscordClient } from "discord.js";
import { log, LogLevel } from "../util/logger";
import { TwitchCommandManager } from "./command-manager";
import { TwitchWebHookManager } from "./webhook-manager";

export interface TwitchEventManagerConfig {
    apiClient: ApiClient;
    chatClient: ChatClient;
    discordClient: DiscordClient;
}

export class TwitchEventManager {
    private _apiClient: ApiClient;
    private _chatClient: ChatClient;
    private _commandManager: TwitchCommandManager;
    private _discordClient: DiscordClient;
    private _webHookManager: TwitchWebHookManager;

    constructor({
        apiClient,
        chatClient,
        discordClient,
    }: TwitchEventManagerConfig) {
        this._apiClient = apiClient;
        this._chatClient = chatClient;
        this._discordClient = discordClient;

        this._commandManager = new TwitchCommandManager({
            apiClient: this._apiClient,
            chatClient: this._chatClient,
        });

        this._webHookManager = new TwitchWebHookManager({
            apiClient: this._apiClient,
            chatClient: this._chatClient,
            discordClient: this._discordClient,
        });
    }

    public async listen(app: ConnectCompatibleApp): Promise<void> {
        this._commandManager.listen();
        await this._webHookManager.listen(app);

        const chatClient = this._chatClient;

        chatClient.onSub((channel, user, subInfo, msg) => {
            log(LogLevel.DEBUG, "onSub: ", {
                channel, user, subInfo, msg,
            });

            chatClient.say(channel, `Thanks to @${subInfo.displayName} for subscribing to the channel!`);
        });

        chatClient.onResub((channel, user, subInfo, msg) => {
            log(LogLevel.DEBUG, "onSub: ", {
                channel, user, subInfo, msg,
            });

            // eslint-disable-next-line max-len
            chatClient.say(channel, `Thanks to @${subInfo.displayName} for subscribing to the channel for a total of ${subInfo.months} months!`);
        });

        chatClient.onSubGift((channel, user, subInfo, msg) => {
            log(LogLevel.DEBUG, "onSub: ", {
                channel, user, subInfo, msg,
            });
            const gifter = subInfo.gifter ? `@${subInfo.gifter}` : "unknown gifter";
            chatClient.say(channel, `Thanks to ${gifter} for gifting a subscription to @${subInfo.displayName}!`);
        });

        chatClient.onHosted((channel, byChannel, auto, viewers) => {
            log(LogLevel.DEBUG, "onHosted: ", {
                channel, byChannel, auto, viewers,
            });

            const suffix = typeof viewers === "number" ? ` for ${viewers} viewers!` : "!";
            chatClient.say(channel, `${byChannel} just hosted the channel${suffix}`);
        });

        chatClient.onRaid((channel, user, raidInfo, msg) => {
            log(LogLevel.DEBUG, "onRaid: ", {
                channel, user, raidInfo, msg,
            });

            // eslint-disable-next-line max-len
            chatClient.say(channel, `@${raidInfo.displayName} just raided the channel with ${raidInfo.viewerCount} viewers!`);
        });
    }

}
