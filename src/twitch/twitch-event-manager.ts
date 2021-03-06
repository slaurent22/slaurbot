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

const MIN_MESSAGE_LENGTH_TO_TRIGGER_UWUIFIER = 15;

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

        this._uwuifier = new Uwuifier();
        this._configureUwuifier();

        this._commandManager = new TwitchCommandManager({
            apiClient: this._apiClient,
            chatClient: this._chatClient,
            discordReader,
            uwuifier: this._uwuifier,
        });

        this._discordNotifier = new DiscordNotifier({
            discordClient: this._discordClient,
        });

        this._logger = getLogger({
            name: "slaurbot-twitch-event-manager",
        });

        this._webHookManager = new TwitchWebHookManager({
            apiClient: this._apiClient,
            discordNotifier: this._discordNotifier,
        });
    }

    public async listen(app: ConnectCompatibleApp): Promise<void> {
        this._initRandomUwuification();

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

    private _configureUwuifier() {
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
    }

    private _initRandomUwuification() {
        const {
            UWU_PERCENT,
        } = getEnv();
        this._chatClient.onMessage((channel, user, _message) => {
            if (Math.random() * 100 > UWU_PERCENT) {
                return;
            }

            const message = _message.trim();
            this._logger.info(`[uwuify] has chosen: ${message}`);

            if (message.length < MIN_MESSAGE_LENGTH_TO_TRIGGER_UWUIFIER) {
                this._logger.info("[uwuify] message is too short, dropping");
                return;
            }

            if (message.startsWith("!")) {
                this._logger.info("[uwuify] message starts with '!', dropping");
                return;
            }

            const response = this._uwuifier.uwuifySentence(message).trim();
            if (message === response) {
                this._logger.info("[uwuify] message === response, dropping");
                return;
            }
            this._chatClient.say(channel, response);
        });
    }
}
