import assert from "assert";
import type { Client as DiscordClient } from "discord.js";
import type { DiscordMessageChannel } from "../util/constants";
import { DISCORD_CHANNEL_ID } from "../util/constants";
import { getLogger } from "../util/logger";

interface DiscordReaderConfig {
    discordClient: DiscordClient;
}

interface Command {
    command: string;
    enabled: boolean;
    message: string;
}

type DBTypes = "string" | "boolean" | "int" | "date";

interface DBSpec {
    rowSchema: Array<DBTypes>;
}

const ROW_REGEX = /```([^]+?)```/g;

const COMMAND_DB_SPEC = {
    rowSchema: [
        "string",  // command name
        "boolean", // enablement
        "string"   // message,
    ] as Array<DBTypes>,
};

function parseMessageContent(dbSpec: DBSpec, content: string) {
    const { rowSchema, } = dbSpec;
    const row = [...content.matchAll(ROW_REGEX)].map(([, captured]) => captured);
    assert(row.length === rowSchema.length,
        `Invalid number of matches: expected ${rowSchema.length}, found ${row.length}`);
    return row.map((value, index) => {
        const dbType = rowSchema[index];
        switch (dbType) {
        case "boolean": {
            if (value === "true") {
                return true;
            }
            if (value === "false") {
                return false;
            }
            throw new Error(`Invalid ${dbType}: ${value}`);
        }
        case "string": {
            return value;
        }
        case "int": {
            const num = parseInt(value, 10);
            if (isNaN(num)) {
                throw new Error(`Invalid ${dbType}: ${value}`);
            }
            return num;
        }
        case "date": {
            return new Date(value);
        }
        default: {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            throw new Error(`Unknown dbType: ${dbType}`);
        }
        }
    });
}

export class DiscordReader {
    private _discordClient: DiscordClient;
    private _twitchCommandsStoreChannel: DiscordMessageChannel;
    private _logger = getLogger({
        name: "slaurbot-discord-reader",
    });

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
            this._logger.info(`msg content: ${content}`);
            const parsedContent = parseMessageContent(COMMAND_DB_SPEC, content) as [string, boolean, string];
            this._logger.info(`parsed: ${parsedContent.join(" ")}`);
            return {
                command: parsedContent[0],
                enabled: parsedContent[1],
                message: parsedContent[2],
            };
        });
    }
}
