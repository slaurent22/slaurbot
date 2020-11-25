import type { ChatClient } from "twitch-chat-client/lib";
import { ApiClient } from "twitch/lib";
import { CommandManager } from "./command-manager";
import { log, LogLevel } from "./logger";

export interface EventManagerConfig {
    apiClient: ApiClient;
    chatClient: ChatClient;
}

const MESSAGE_COMMANDS = Object.freeze({
    "!ping": "pong!",
    "!discord": "We have a Discord! If you want to be notified when I go live, or just s**tpost, fall into the Abyss here: https://discord.gg/D5P8gNN",
    "!twitter": "https://twitter.com/slaurent22",
    "!oof": "oof 🤮 owie 🤮 OwOuch major 👌 OOF (╯°□°）╯︵ ┻━┻ I can't 🙏📿 bewieve 🙏📿 the yikes uwu 😂 Y I K E S 😂",
    "!challenge": "If the goal is met, I will spend a long stream trying the skips on ins0mina's list: https://docs.google.com/spreadsheets/d/1s_1FUALP1IxgjFFaII9XApuHWIdtf4lv1fTOBhawkAg/edit#gid=0"
});

export class EventManager {
    private _apiClient: ApiClient;
    private _chatClient: ChatClient;
    private _commandManager: CommandManager;

    constructor({
        apiClient,
        chatClient,
    }: EventManagerConfig) {
        this._apiClient = apiClient;
        this._chatClient = chatClient;
        this._commandManager = new CommandManager({
            commandPrefix: "",
            chatClient: this._chatClient,
            messageCommands: MESSAGE_COMMANDS,
        });
        this._initCommandManager();
    }

    private _initCommandManager() {
        const commandManager = this._commandManager;

        commandManager.addCommand("!dice", (params, context) => {
            const diceRoll = Math.floor(Math.random() * 6) + 1;
            context.say(`@${context.user} rolled a ${diceRoll}`);
        });

        commandManager.addCommand("!followage", async (params, context) => {
            const follow = await this._apiClient.kraken.users
                .getFollowedChannel(
                    context.msg.userInfo.userId as string,
                    context.msg.channelId as string);

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
    }

    public listen(): void {
        this._commandManager.listen();
        const chatClient = this._chatClient;

        chatClient.onSub((channel, user, subInfo, msg) => {
            log(LogLevel.DEBUG, "onSub: ", {
                channel, user, subInfo, msg
            });

            chatClient.say(channel, `Thanks to @${user} for subscribing to the channel!`);
        });

        chatClient.onResub((channel, user, subInfo, msg) => {
            log(LogLevel.DEBUG, "onSub: ", {
                channel, user, subInfo, msg
            });

            chatClient.say(channel, `Thanks to @${user} for subscribing to the channel for a total of ${subInfo.months} months!`);
        });

        chatClient.onSubGift((channel, user, subInfo, msg) => {
            log(LogLevel.DEBUG, "onSub: ", {
                channel, user, subInfo, msg
            });
            chatClient.say(channel, `Thanks to @${subInfo.gifter} for gifting a subscription to @${user}!`);
        });

        chatClient.onHosted((channel, byChannel, auto, viewers) => {
            log(LogLevel.DEBUG, "onHosted: ", {
                channel, byChannel, auto, viewers
            });

            const suffix = typeof viewers === "number" ? ` for ${viewers} viewers!` : "!";
            chatClient.say(channel, `${byChannel} just hosted the channel${suffix}`);
        });

        chatClient.onRaid((channel, user, raidInfo, msg) => {
            log(LogLevel.DEBUG, "onRaid: ", {
                channel, user, raidInfo, msg
            });

            chatClient.say(channel, `${user} just raided the channel with ${raidInfo.viewerCount} viewers!`);
        });
    }

}