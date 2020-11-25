import { getEnv, getTokenData, writeTokenData } from "./env";
import { log, LogLevel } from "./logger";
import { RefreshableAuthProvider, StaticAuthProvider, AuthProvider } from "twitch-auth";
import { ChatClient } from "twitch-chat-client";
import { ApiClient } from "twitch";
import { EventManager } from "./event-manager";

export interface Bot {
    apiClient: ApiClient;
    authProvider: AuthProvider;
    chatClient: ChatClient;
}

async function createBot(): Promise<Bot> {
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
            onRefresh: async ({ accessToken, refreshToken, expiryDate }) => {
                log(LogLevel.INFO, "Received refresh");
                const newTokenData = {
                    accessToken,
                    refreshToken,
                    expiryTimestamp: expiryDate === null ? null : expiryDate.getTime()
                };
                writeTokenData(newTokenData);
            }
        }
    );

    const apiClient = new ApiClient({
        authProvider,
        logLevel: 4, // debug
    });

    const chatClient = new ChatClient(authProvider, {
        channels: [env.CHANNEL_NAME],
        logger: {
            name: "SLAURBOT",
            timestamps: true,
            minLevel: "DEBUG",
            colors: false,
        }
    });

    log(LogLevel.INFO, "Bot created");

    return {
        apiClient,
        authProvider,
        chatClient
    };
}

export async function init(): Promise<Bot> {
    const bot = await createBot();
    const {
        apiClient,
        chatClient
    } = bot;
    await chatClient.connect();

    const eventManager = new EventManager({
        apiClient,
        chatClient
    });
    eventManager.listen();

    return bot;
}

