import type { ChatClient, PrivateMessage } from "twitch-chat-client";
import type { BotCommand, BotCommandMatch } from "easy-twitch-bot";
import { BotCommandContext, createBotCommand } from "easy-twitch-bot";
import type { Logger } from "@d-fischer/logger";
import { getLogger } from "../util/logger";

export interface SimpleTwitchBotConfig {
    chatClient: ChatClient;
    commandPrefix: string;
}

export type CommandHandler = (params: string[], context: BotCommandContext) => void | Promise<void>;

export interface CommandPermissions {
    broadcaster: boolean;
    founder: boolean;
    mod: boolean;
    subscriber: boolean;
    vip: boolean;
}

export interface CommandOptions {
    cooldown?: number;
    permissions?: CommandPermissions;
}

function refreshed(lastUse: Date|undefined, cooldownMs: number) {
    if (!lastUse) {
        return true;
    }
    return Number(new Date()) - Number(lastUse) > cooldownMs;
}

export class SimpleTwitchBot {
    private _chatClient: ChatClient;
    private _commandPrefix: string;
    private _commands = new Map<string, BotCommand>();
    private _commandLastUsed = new Map<string, Date>();
    private _logger: Logger;

    constructor({
        chatClient,
        commandPrefix,
    }: SimpleTwitchBotConfig) {
        this._chatClient = chatClient;
        this._commandPrefix = commandPrefix;

        this._logger = getLogger({
            name: "simple-twitch-bot",
        });
    }

    public addCommand(commandName: string, handler: CommandHandler, options?: CommandOptions): void {
        const metaHandler = this._createMetaHandler(commandName, handler, options);
        const command = createBotCommand(commandName, metaHandler);
        this._commands.set(commandName, command);
        this._logger.info(`Command added: ${commandName}`);
    }

    public removeCommand(commandName: string): void {
        this._commands.delete(commandName);
        this._logger.info(`Command removed: ${commandName}`);
    }

    public listen(): void {
        // https://github.com/d-fischer/twitch/blob/master/packages/easy-twitch-bot/src/Bot.ts
        this._chatClient.onMessage(async(channel, user, message, msg) => {
            const match = this._findMatch(msg);
            if (match === null) {
                return;
            }
            const commandContext = new BotCommandContext(this._chatClient, msg);
            try {
                this._logger.info("Executing command:" + match.command.name);
                await match.command.execute(match.params, commandContext);
            }
            catch (e) {
                const errMsg = `${match.command.name} command failed`;
                this._logger.error(`${errMsg}:` + String(e));
                commandContext.say(errMsg);
            }
        });

        this._logger.info("Listening for commands");
    }

    private _createMetaHandler(commandName: string, handler: CommandHandler, options?: CommandOptions): CommandHandler {
        return (params: string[], context: BotCommandContext) => {
            if (!options) {
                return handler(params, context);
            }
            const user = context.msg.userInfo;
            const userDisplayName = user.displayName;
            if (options.permissions) {
                const allowedOptions = [
                    options.permissions.broadcaster && user.isBroadcaster,
                    options.permissions.founder     && user.isFounder,
                    options.permissions.mod         && user.isMod,
                    options.permissions.subscriber  && user.isSubscriber,
                    options.permissions.vip         && user.isVip
                ];
                this._logger.debug("allowed options: " + allowedOptions.join(" "));

                const allowed = allowedOptions.some(option => option);
                this._logger.info("allowed = " + String(allowed));

                if (!allowed) {
                    context.say(`@${userDisplayName} you are not allowed to use ${commandName}`);
                    return;
                }
            }
            if (options.cooldown) {
                const commandLastUsed = this._commandLastUsed.get(commandName);
                const isRefreshed = refreshed(commandLastUsed, options.cooldown);
                if (!isRefreshed) {
                    context.say(`@${userDisplayName}, ${commandName} is still on cooldown`);
                    return;
                }
                this._commandLastUsed.set(commandName, new Date());
            }

            return handler(params, context);
        };
    }

    // https://github.com/d-fischer/twitch/blob/master/packages/easy-twitch-bot/src/Bot.ts
    private _findMatch(msg: PrivateMessage): BotCommandMatch | null {
        const line = msg.params.message.trim().replace(/  +/g, " ");
        for (const command of this._commands.values()) {
            const params = command.match(line, this._commandPrefix);
            if (params !== null) {
                return {
                    command,
                    params,
                };
            }
        }
        return null;
    }
}
