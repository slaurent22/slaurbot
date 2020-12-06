import type { AuthProvider } from "twitch-auth";
import { RefreshableAuthProvider, StaticAuthProvider } from "twitch-auth";
import { ChatClient } from "twitch-chat-client";
import { ApiClient } from "twitch";
import type { ConnectCompatibleApp } from "twitch-webhooks/lib";
import type { Client as DiscordClient } from "discord.js";
import { log, LogLevel } from "../util/logger";
import { getEnv } from "../util/env";
import { TwitchEventManager } from "./event-manager";
import type { TokenData } from "./twitch-token-cache";
import { writeTwitchTokens } from "./twitch-token-cache";

export interface TwitchBotConfig {
    apiClient: ApiClient;
    authProvider: AuthProvider;
    chatClient: ChatClient;
}

export function createBotConfig(tokenData: TokenData): TwitchBotConfig {
    log(LogLevel.INFO, "Creating bot config");
    const env = getEnv();
    if (env === null) {
        throw new Error("Local environment not found");
    }

    const authProvider = new RefreshableAuthProvider(
        new StaticAuthProvider(env.TWITCH_CLIENT_ID, tokenData.accessToken),
        {
            clientSecret: env.TWITCH_CLIENT_SECRET,
            refreshToken: tokenData.refreshToken,
            expiry: tokenData.expiryTimestamp === null ? null : new Date(tokenData.expiryTimestamp),
            onRefresh: async({ accessToken, refreshToken, expiryDate, }) => {
                log(LogLevel.INFO, "RefreshableAuthProvider: received refresh");
                const newTokenData = {
                    accessToken,
                    refreshToken,
                    expiryTimestamp: expiryDate === null ? null : expiryDate.getTime(),
                };
                await writeTwitchTokens(newTokenData);
            },
        }
    );

    const apiClient = new ApiClient({
        authProvider,
        logLevel: 4, // debug
    });

    const chatClient = new ChatClient(authProvider, {
        channels: [env.TWITCH_CHANNEL_NAME ],
        logger: {
            name: "SLAURBOT",
            timestamps: true,
            minLevel: "DEBUG",
            colors: false,
        },
    });

    return {
        apiClient,
        authProvider,
        chatClient,
    };
}

interface SlaurbotConfig {
    discordClient: DiscordClient;
    tokenData: TokenData;
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
            chatClient,
        } = createBotConfig(tokenData);

        this._chatClient = chatClient;
        this._discordClient = discordClient;

        this._eventManager = new TwitchEventManager({
            apiClient,
            chatClient,
            discordClient,
        });
    }

    public async start(app: ConnectCompatibleApp): Promise<void> {
        await Promise.all([
            this._chatClient.connect(),
            this._eventManager.listen(app)
        ]);
    }

    public destroy(): void {
        this._discordClient.destroy();
        void this._chatClient.quit();
    }
}
