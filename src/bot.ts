import { getEnv, getTokenData, writeTokenData } from "./env";
import { log, LogLevel } from "./logger";
import { RefreshableAuthProvider, StaticAuthProvider, AuthProvider } from "twitch-auth";
import { ChatClient } from "twitch-chat-client";
import { CommandManager } from "./command-manager";

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
        authProvider,
        chatClient
    };
}

export async function init(): Promise<Bot> {
    const bot = await createBot();
    const { chatClient } = bot;
    await chatClient.connect();

    const commandManager = new CommandManager({
        commandPrefix: "!!",
        chatClient
    });

    commandManager.addCommand("ping", (params, context) => {
        context.say("pong!");
    });

    commandManager.addCommand("dice", (params, context) => {
        const diceRoll = Math.floor(Math.random() * 6) + 1;
        context.say(`@${context.user} rolled a ${diceRoll}`);
    });

    commandManager.listen();


    return bot;
}

