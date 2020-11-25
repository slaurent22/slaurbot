import { getEnv, getTokenData, writeTokenData } from "./env";
import { log, LogLevel } from "./logger";
import { RefreshableAuthProvider, StaticAuthProvider, AuthProvider } from "twitch-auth";
import { ChatClient } from "twitch-chat-client";
import { ApiClient } from "twitch";
import { CommandManager } from "./command-manager";

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

const MESSAGE_COMMANDS = Object.freeze({
    "!ping": "pong!",
    "!discord": "We have a Discord! If you want to be notified when I go live, or just s**tpost, fall into the Abyss here: https://discord.gg/D5P8gNN",
    "!twitter": "https://twitter.com/slaurent22",
    "!oof": "oof 🤮 owie 🤮 OwOuch major 👌 OOF (╯°□°）╯︵ ┻━┻ I can't 🙏📿 bewieve 🙏📿 the yikes uwu 😂 Y I K E S 😂",
    "!challenge": "If the goal is met, I will spend a long stream trying the skips on ins0mina's list: https://docs.google.com/spreadsheets/d/1s_1FUALP1IxgjFFaII9XApuHWIdtf4lv1fTOBhawkAg/edit#gid=0"
});

export async function init(): Promise<Bot> {
    const bot = await createBot();
    const {
        apiClient,
        chatClient
    } = bot;
    await chatClient.connect();

    const commandManager = new CommandManager({
        commandPrefix: "",
        chatClient,
        messageCommands: MESSAGE_COMMANDS,
    });

    commandManager.addCommand("!dice", (params, context) => {
        const diceRoll = Math.floor(Math.random() * 6) + 1;
        context.say(`@${context.user} rolled a ${diceRoll}`);
    });

    commandManager.addCommand("!followage", async (params, context) => {
        const follow = await apiClient.kraken.users.getFollowedChannel(context.msg.userInfo.userId as string, context.msg.channelId as string);

        if (follow) {
            context.say(`@${context.user} You have been following since ${follow.followDate.toLocaleString()}`);
        } else {
            context.say(`@${context.user} You are not following!`);
        }
    });

    commandManager.addCommand("TPFufun", async (params, context) => {
        const edThoone = context.msg.userInfo.userId === "450323894";

        if (edThoone) {
            context.say("TPFufun");
        }
    });

    commandManager.listen();


    return bot;
}

