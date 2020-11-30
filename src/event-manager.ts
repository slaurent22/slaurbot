import type { ChatClient } from "twitch-chat-client/lib";
import type { ConnectCompatibleApp } from "twitch-webhooks/lib";
import type { ApiClient } from "twitch/lib";
import { CommandManager } from "./command-manager";
import { log, LogLevel } from "./logger";
import { WebHookManager } from "./webhook-manager";

export interface EventManagerConfig {
    apiClient: ApiClient;
    chatClient: ChatClient;
}

export class EventManager {
    private _apiClient: ApiClient;
    private _chatClient: ChatClient;
    private _commandManager: CommandManager;
    private _webHookManager: WebHookManager;

    constructor({
        apiClient,
        chatClient,
    }: EventManagerConfig) {
        this._apiClient = apiClient;
        this._chatClient = chatClient;

        this._commandManager = new CommandManager({
            apiClient: this._apiClient,
            chatClient: this._chatClient,
        });

        this._webHookManager = new WebHookManager({
            apiClient: this._apiClient,
            chatClient: this._chatClient,
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
