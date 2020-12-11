import assert from "assert";
import type {
    Client as DiscordClient,
    DMChannel,
    NewsChannel,
    TextChannel
} from "discord.js";
import { DISCORD_CHANNEL_ID } from "../util/constants";

interface DiscordReaderConfig {
    discordClient: DiscordClient;
}

interface Command {
    command: string;
    enabled: boolean;
    message: string;
}

export class DiscordReader {
    private _discordClient: DiscordClient;
    private _twitchCommandsStoreChannel: TextChannel | DMChannel | NewsChannel;

    constructor({
        discordClient,
    }: DiscordReaderConfig) {
        this._discordClient = discordClient;
        const twitchCommandsStoreChannel =
            this._discordClient.channels.cache.get(DISCORD_CHANNEL_ID.TWITCH_COMMANDS_STORE);

        assert(twitchCommandsStoreChannel && twitchCommandsStoreChannel.isText());
        this._twitchCommandsStoreChannel = twitchCommandsStoreChannel;
    }

    public async readTwitchCommands(): Promise<Array<Command>> {
        const messages = this._twitchCommandsStoreChannel.messages;
        const messageCollection = await messages.fetch({}, false, true);
        return messageCollection.array().map(({ content, }) => {
            const commandParts = content.split(/\s+/);
            assert(commandParts.length > 2);
            const enabledParam = commandParts[1];
            assert(enabledParam === "true" || enabledParam === "false");
            const message = commandParts.splice(2);
            return {
                command: commandParts[0],
                enabled: enabledParam === "true",
                message: message.join(" ").replace(/`/g, "").trim(),
            };
        });
    }
}
