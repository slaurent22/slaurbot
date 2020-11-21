import { getEnv, getTokenData, writeTokenData } from "./env";
import { log, LogLevel } from "./logger";
import { RefreshableAuthProvider, StaticAuthProvider, AuthProvider } from "twitch-auth";
import { ChatClient } from "twitch-chat-client";

export interface Bot {
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

    const chatClient = new ChatClient(authProvider, { channels: [env.CHANNEL_NAME] });

    log(LogLevel.INFO, "Bot created");

    return {
        authProvider,
        chatClient
    };
}

function logMsg(msg: string|undefined) {
    log(LogLevel.DEBUG, `[MSG] ${msg}`);
}

export async function init(): Promise<Bot> {
    const bot = await createBot();

    const { chatClient } = bot;

    chatClient.onAnyMessage(msg => {
        logMsg(msg.rawLine);
    });

    await chatClient.connect();

    chatClient.onMessage((channel, user, message) => {
        log(LogLevel.INFO, `[${channel}; ${user}]`, message);
        if (message === "!ping") {
            chatClient.say(channel, "Pong!");
        } else if (message === "!dice") {
            const diceRoll = Math.floor(Math.random() * 6) + 1;
            chatClient.say(channel, `@${user} rolled a ${diceRoll}`);
        }
    });

    return bot;
}

