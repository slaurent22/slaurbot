import type { AccessToken, AuthProvider } from "@twurple/auth";
import { ClientCredentialsAuthProvider, RefreshingAuthProvider } from "@twurple/auth";
import { ChatClient } from "@twurple/chat";
import { ApiClient } from "@twurple/api";
import { EventSubListener, EnvPortAdapter } from "@twurple/eventsub";
import type { Client as DiscordClient } from "discord.js";
import { getLogger } from "./util/logger";
import { getEnv } from "./util/env";
import { TwitchEventManager } from "./twitch/twitch-event-manager";
import { writeTwitchTokens } from "./twitch/twitch-token-cache";

export interface TwitchBotConfig {
    apiClient: ApiClient;
    authProvider: AuthProvider;
    chatClient: ChatClient;
    eventSubListener: EventSubListener;
}

const logger = getLogger({
    name: "slaurbot-startup",
});

export function createBotConfig(tokenData: AccessToken): TwitchBotConfig {
    logger.info("Creating bot config");
    const env = getEnv();
    if (env === null) {
        throw new Error("Local environment not found");
    }

    const authProvider = new RefreshingAuthProvider(
        {
            clientId: env.TWITCH_CLIENT_ID,
            clientSecret: env.TWITCH_CLIENT_SECRET,
            onRefresh: async(newTokenData) => {
                logger.info("RefreshableAuthProvider: received refresh");
                await writeTwitchTokens(newTokenData);
            },
        },
        tokenData
    );

    const apiClient = new ApiClient({
        authProvider,
        logger: { minLevel: env.LOG_LEVEL, },
    });

    const eventSubListener = new EventSubListener({
        apiClient,
        adapter: new EnvPortAdapter({
            hostName: "slaurbot.herokuapp.com",
        }),
        secret: env.TWITCH_EVENTSUB_SECRET,
    });

    const chatClient = new ChatClient({
        authProvider,
        channels: [env.TWITCH_CHANNEL_NAME ],
        logger: {
            name: "twitch-chat-client",
            timestamps: true,
            minLevel: env.LOG_LEVEL,
            colors: false,
        },
    });

    return {
        apiClient,
        authProvider,
        chatClient,
        eventSubListener,
    };
}

export function createEventSubListener(): {apiClient: ApiClient; eventSubListener: EventSubListener} {
    logger.info("Creating eventSubListener");
    const env = getEnv();
    if (env === null) {
        throw new Error("Local environment not found");
    }
    const authProvider = new ClientCredentialsAuthProvider(env.TWITCH_CLIENT_ID, env.TWITCH_CLIENT_SECRET);
    const apiClient = new ApiClient({
        authProvider,
        logger: { minLevel: env.LOG_LEVEL, },
    });

    const eventSubListener = new EventSubListener({
        apiClient,
        adapter: new EnvPortAdapter({
            hostName: "slaurbot.herokuapp.com",
        }),
        secret: env.TWITCH_EVENTSUB_SECRET,
    });

    return { apiClient, eventSubListener, };
}
interface SlaurbotConfig {
    discordClient: DiscordClient;
    tokenData: AccessToken;
}

export class Slaurbot {
    private _chatClient: ChatClient;
    private _discordClient: DiscordClient;
    private _eventManager: TwitchEventManager;

    constructor({
        discordClient,
        tokenData,
    }: SlaurbotConfig) {
        const {
            apiClient,
            authProvider,
            chatClient,
        } = createBotConfig(tokenData);

        this._chatClient = chatClient;
        this._discordClient = discordClient;

        this._eventManager = new TwitchEventManager({
            apiClient,
            authProvider,
            chatClient,
            discordClient,
        });
    }

    public async start(): Promise<void> {
        await Promise.all([
            this._chatClient.connect(),
            this._eventManager.listen()
        ]);
    }

    public destroy(): void {
        this._discordClient.destroy();
        void this._chatClient.quit();
    }
}
