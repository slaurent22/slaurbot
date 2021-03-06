import assert from "assert";
import type { Client as DiscordClient, Collection } from "discord.js";
import type { DiscordMessageChannel } from "../util/constants";
import { getLogger } from "../util/logger";

export enum DBTypes {
    STRING = "STRING",
    BOOLEAN = "BOOLEAN",
    INT = "INT",
    DATE = "DATE",
}

interface DBSpec {
    rowSchema: Array<DBTypes>;
}

interface DiscordChannelDatastoreConfig {
    channelId: string;
    discordClient: DiscordClient;
    dbSpec: DBSpec;
}

type DBValueType = string | number | boolean | Date;


const ROW_REGEX = /```([^]+?)```/g;

function parseMessageContent(dbSpec: DBSpec, content: string) {
    const { rowSchema, } = dbSpec;
    const row = [...content.matchAll(ROW_REGEX)].map(([, captured]) => captured);
    assert(row.length === rowSchema.length,
        `Invalid number of matches: expected ${rowSchema.length}, found ${row.length}`);
    return row.map((value, index) => {
        const dbType = rowSchema[index];
        switch (dbType) {
        case DBTypes.BOOLEAN: {
            if (value === "true") {
                return true;
            }
            if (value === "false") {
                return false;
            }
            throw new Error(`Invalid ${dbType}: ${value}`);
        }
        case DBTypes.STRING: {
            return value;
        }
        case DBTypes.INT: {
            const num = parseInt(value, 10);
            if (isNaN(num)) {
                throw new Error(`Invalid ${dbType}: ${value}`);
            }
            return num;
        }
        case DBTypes.DATE: {
            return new Date(value);
        }
        default: {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            throw new Error(`Unknown dbType: ${dbType}`);
        }
        }
    });
}

export class DiscordChannelDataStore {
    private _discordClient: DiscordClient;
    private _dbSpec: DBSpec;
    private _storeChannel: DiscordMessageChannel;
    private _logger = getLogger({
        name: "slaurbot-discord-channel-datastore",
    });

    constructor({
        channelId,
        discordClient,
        dbSpec,
    }: DiscordChannelDatastoreConfig) {
        this._discordClient = discordClient;
        this._dbSpec = dbSpec;
        const storeChannel =
            this._discordClient.channels.cache.get(channelId);

        assert(storeChannel && storeChannel.isText(), `Specified channel ${channelId} is invalid`);
        this._storeChannel = storeChannel;
    }

    public async readChannel(): Promise<Collection<string, Array<DBValueType>>> {
        const messages = this._storeChannel.messages;
        const messageCollection = await messages.fetch({}, false, true);
        return messageCollection.mapValues(message => {
            const { content, } = message;
            this._logger.debug(`msg content: ${content}`);
            const parsedContent = parseMessageContent(this._dbSpec, content);
            this._logger.debug(`parsed: ${parsedContent.join(" ")}`);
            return parsedContent;
        });
    }
}
