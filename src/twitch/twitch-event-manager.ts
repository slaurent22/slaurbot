import type { ChatClient } from "twitch-chat-client/lib";
import type { ConnectCompatibleApp } from "twitch-webhooks/lib";
import type { ApiClient } from "twitch/lib";
import { PubSubClient } from "twitch-pubsub-client";
import type { Client as DiscordClient } from "discord.js";
import type { Logger } from "@d-fischer/logger";
import { Uwuifier } from "uwuifier";
import { getLogger } from "../util/logger";
import { DiscordNotifier } from "../discord/discord-notifier";
import { DiscordReader } from "../discord/discord-reader";
import { getEnv } from "../util/env";
import { TwitchCommandManager } from "./twitch-command-manager";
import { TwitchWebHookManager } from "./twitch-webhook-manager";

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
    private _discordNotifier: DiscordNotifier;
    private _logger: Logger;
    private _pubSubClient: PubSubClient;
    private _uwuifier: Uwuifier;
    private _webHookManager: TwitchWebHookManager;

    constructor({
        apiClient,
        chatClient,
        discordClient,
    }: TwitchEventManagerConfig) {
        this._apiClient = apiClient;
        this._chatClient = chatClient;
        this._discordClient = discordClient;
        this._pubSubClient = new PubSubClient();

        const discordReader = new DiscordReader({
            discordClient: this._discordClient,
        });

        this._commandManager = new TwitchCommandManager({
            apiClient: this._apiClient,
            chatClient: this._chatClient,
            discordReader,
        });

        this._discordNotifier = new DiscordNotifier({
            discordClient: this._discordClient,
        });

        this._logger = getLogger({
            name: "slaurbot-twitch-event-manager",
        });

        this._webHookManager = new TwitchWebHookManager({
            apiClient: this._apiClient,
            chatClient: this._chatClient,
            discordNotifier: this._discordNotifier,
        });

        this._uwuifier = new Uwuifier();
        this._addUwu();
    }

    public async listen(app: ConnectCompatibleApp): Promise<void> {
        await this._commandManager.listen();
        await this._webHookManager.listen(app);

        const chatClient = this._chatClient;
        const pubSubClient = this._pubSubClient;
        const pubSubUserId = await this._pubSubClient.registerUserListener(this._apiClient);

        chatClient.onSub((channel, user, subInfo, msg) => {
            this._logger.debug("onSub: " + JSON.stringify({
                channel, user, subInfo, msg,
            }));

            let suffix = "!";

            switch (subInfo.plan) {
            case "1000":
                suffix = " at Tier 1!";
                break;
            case "2000":
                suffix = " at Tier 2!";
                break;
            case "3000":
                suffix = " at Tier 3!";
                break;
            case "Prime":
                suffix = " with Prime!";
                break;
            default:
                this._logger.warn(`Unknown plan:'${subInfo.plan}'`);
            }

            chatClient.say(channel, `Thanks to @${subInfo.displayName} for subscribing to the channel${suffix}`);
        });

        chatClient.onResub((channel, user, subInfo, msg) => {
            this._logger.debug("onSub: " + JSON.stringify({
                channel, user, subInfo, msg,
            }));

            // eslint-disable-next-line max-len
            chatClient.say(channel, `Thanks to @${subInfo.displayName} for subscribing to the channel for a total of ${subInfo.months} months!`);
        });

        chatClient.onSubGift((channel, user, subInfo, msg) => {
            this._logger.debug("onSub: " + JSON.stringify({
                channel, user, subInfo, msg,
            }));
            const gifter = subInfo.gifter ? `@${subInfo.gifter}` : "unknown gifter";
            chatClient.say(channel, `Thanks to ${gifter} for gifting a subscription to @${subInfo.displayName}!`);
        });

        chatClient.onHosted((channel, byChannel, auto, viewers) => {
            this._logger.debug("onHosted: " + JSON.stringify({
                channel, byChannel, auto, viewers,
            }));

            const suffix = typeof viewers === "number" ? ` for ${viewers} viewers!` : "!";
            chatClient.say(channel, `${byChannel} just hosted the channel${suffix}`);
        });

        chatClient.onRaid((channel, user, raidInfo, msg) => {
            this._logger.debug("onRaid: " + JSON.stringify({
                channel, user, raidInfo, msg,
            }));

            // eslint-disable-next-line max-len
            chatClient.say(channel, `@${raidInfo.displayName} just raided the channel with ${raidInfo.viewerCount} viewers!`);
        });

        const {
            TWITCH_CHANNEL_NAME,
        } = getEnv();

        await pubSubClient.onBits(pubSubUserId, async(message) => {
            if (message.isAnonymous) {
                // eslint-disable-next-line max-len
                chatClient.say(TWITCH_CHANNEL_NAME, `Anonymous just cheered ${message.bits}! Thank you slaureLove`);
                return;
            }

            if (!message.userId) {
                chatClient.say(TWITCH_CHANNEL_NAME,
                    `Unknown user just cheered ${message.bits}! Thank you slaureLove`);
                return;
            }

            const user = await this._apiClient.helix.users.getUserById(message.userId);
            if (!user) {
                chatClient.say(TWITCH_CHANNEL_NAME,
                    `Unknown user just cheered ${message.bits}! Thank you slaureLove`);
                return;
            }

            // eslint-disable-next-line max-len
            chatClient.say(TWITCH_CHANNEL_NAME, `@${user.displayName} just cheered ${message.bits}! That brings their total to ${message.totalBits}! Thank you slaureLove`);
        });
    }

    private _addUwu() {
        const {
            UWU_PERCENT,
        } = getEnv();

        // this list from https://github.com/Schotsl/Uwuifier-node/blob/master/src/index.ts#L17,
        // with some of the more cursed elements removed
        this._uwuifier.actions = [
            "*blushes*",
            "*sweats*",
            "*runs away*",
            "*walks away*",
            "*looks at you*",
            "*huggles tightly*",
            "*boops your nose*"
        ];

        this._chatClient.onMessage((channel, user, message) => {
            if (Math.random() * 100 < UWU_PERCENT && message.length > 15) {
                const response = this._uwuifier.uwuifySentence(message);
                this._chatClient.say(channel, response);
            }
        });
    }
}
