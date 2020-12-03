import type { AuthProvider } from "twitch-auth";
import { RefreshableAuthProvider, StaticAuthProvider } from "twitch-auth";
import { ChatClient } from "twitch-chat-client";
import { ApiClient } from "twitch";
import type { ConnectCompatibleApp } from "twitch-webhooks/lib";
import { log, LogLevel } from "../util/logger";
import { getEnv, getTokenData, writeTokenData } from "../util/env";
import { TwitchEventManager } from "./event-manager";

export interface TwitchBot {
    apiClient: ApiClient;
    authProvider: AuthProvider;
    chatClient: ChatClient;
}

export async function createBot(): Promise<TwitchBot> {
    log(LogLevel.INFO, "Creating bot");
    const env = getEnv();
    if (env === null) {
        throw new Error("Local environment not found");
    }
    const tokenData = await getTokenData();

    const authProvider = new RefreshableAuthProvider(
        new StaticAuthProvider(env.CLIENT_ID, tokenData.accessToken),
        {
            clientSecret: env.CLIENT_SECRET,
            refreshToken: tokenData.refreshToken,
            expiry: tokenData.expiryTimestamp === null ? null : new Date(tokenData.expiryTimestamp),
            onRefresh: async({ accessToken, refreshToken, expiryDate, }) => {
                log(LogLevel.INFO, "RefreshableAuthProvider: received refresh");
                const newTokenData = {
                    accessToken,
                    refreshToken,
                    expiryTimestamp: expiryDate === null ? null : expiryDate.getTime(),
                };
                await writeTokenData(newTokenData);
            },
        }
    );

    const apiClient = new ApiClient({
        authProvider,
        logLevel: 4, // debug
    });

    const chatClient = new ChatClient(authProvider, {
        channels: [env.CHANNEL_NAME ],
        logger: {
            name: "SLAURBOT",
            timestamps: true,
            minLevel: "DEBUG",
            colors: false,
        },
    });

    log(LogLevel.INFO, "Bot created");

    return {
        apiClient,
        authProvider,
        chatClient,
    };
}

export async function init(app: ConnectCompatibleApp): Promise<TwitchBot> {
    const bot = await createBot();
    const {
        apiClient,
        chatClient,
    } = bot;
    await chatClient.connect();

    const eventManager = new TwitchEventManager({
        apiClient,
        chatClient,
    });
    await eventManager.listen(app);

    return bot;
}

