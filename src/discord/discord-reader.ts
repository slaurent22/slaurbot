import type { Client as DiscordClient } from "discord.js";
import { DISCORD_CHANNEL_ID } from "../util/constants";
import { getLogger } from "../util/logger";
import { DBTypes, DiscordChannelDataStore } from "./discord-channel-datastore";

interface DiscordReaderConfig {
    discordClient: DiscordClient;
}

interface Command {
    command: string;
    enabled: boolean;
    message: string;
}

const COMMAND_DB_SPEC = {
    rowSchema: [
        DBTypes.STRING,  // command name
        DBTypes.BOOLEAN, // enablement
        DBTypes.STRING   // message,
    ],
};

export class DiscordReader {
    private _discordClient: DiscordClient;
    private _twitchCommandsDataStore: DiscordChannelDataStore;
    private _logger = getLogger({
        name: "slaurbot-discord-reader",
    });

    constructor({
        discordClient,
    }: DiscordReaderConfig) {
        this._discordClient = discordClient;
        this._twitchCommandsDataStore = new DiscordChannelDataStore({
            channelId: DISCORD_CHANNEL_ID.TWITCH_COMMANDS_STORE,
            discordClient: this._discordClient,
            dbSpec: COMMAND_DB_SPEC,
        });
    }

    public async readTwitchCommands(): Promise<Array<Command>> {
        const channelStoreData = await this._twitchCommandsDataStore.readChannel();
        return channelStoreData.map(parsedContent => {
            const command = parsedContent[0] as string;
            const enabled = parsedContent[1] as boolean;
            const message = parsedContent[2] as string;
            return {
                command, enabled, message,
            };
        });
    }
}
