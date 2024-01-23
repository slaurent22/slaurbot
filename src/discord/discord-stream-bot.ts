/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */

import type { Activity, GuildMember, Message, Presence } from "discord.js";
import Discord from "discord.js";
import type { Logger } from "@d-fischer/logger/lib";
import { getLogger } from "../util/logger";
import { generateUuid } from "../util/uuid";
import { discordUserString, guildMemberString, guildString } from "../util/log-strings";
import KeyedQueue from "../util/keyed-queue";
import { DISCORD_CLIENT_INTENTS } from "../util/constants";
import { DiscordSheo } from "./discord-sheo";

export interface DiscordStreamBotConfig {
    cooldownInterval: number;
    name: string;
    streamingMembersChannelId?: string;
    streamingRoleId?: string;
    filter?: (activity: Activity, guildMember: GuildMember) => boolean;
    modRole?: string;
}

/**
 * A generic bot that can post a message and add a role while a Discord member
 * is streaming
 */
export class DiscordStreamBot {
    #botToken: string;
    #config: Map<string, DiscordStreamBotConfig>;
    #sheos = new Map<string, DiscordSheo>();
    #client: Discord.Client;
    #logger: Logger;
    #userUpdateQueue = new KeyedQueue<string, void>();
    #readOnly = false;

    constructor(botToken: string, config: Map<string, DiscordStreamBotConfig>, readOnly = false) {
        this.#botToken = botToken;
        this.#config = config;
        this.#logger = getLogger({ name: "streambot-sheo", });
        this.#readOnly = readOnly;

        this.#client = new Discord.Client({
            intents: DISCORD_CLIENT_INTENTS,
        });
        this.#client.once("ready", this.#onReady.bind(this));
    }

    public async login(): Promise<void> {
        const loginResult = await this.#client.login(this.#botToken);
        if (loginResult !== this.#botToken) {
            this.#logger.warn("login return value does not match botToken");
        }
        else {
            this.#logger.info("Discord client has logged in");
        }
    }

    public async destroy() {
        this.#logger.info("destroying");

        await Promise.all([...this.#sheos.values()].map(sheo => sheo.destroy()));
        this.#sheos.clear();
    }

    async #onReady() {
        this.#logger.info("Discord client is ready");
        this.#client.on("presenceUpdate", this.#onPresenceUpdate.bind(this));
        this.#client.on("messageCreate", this.#onMessageCreate.bind(this));
        await Promise.all([...this.#config.entries()].map(([g, c]) => this.#readyGuild(g, c)));
    }

    #onPresenceUpdate(oldPresence: Presence | null, newPresence: Presence) {
        const eid = generateUuid();
        const {
            user, guild, member,
        } = newPresence;

        let event = `[${eid}] presenceUpdate:`;
        if (!user) {
            this.#logger.error(`${event} without user`);
            return;
        }

        event = `${event} ${discordUserString(user)}`;

        if (!member) {
            this.#logger.error(`${event} without guild member`);
            return;
        }

        event = `${event} ${guildMemberString(member)}`;

        if (!guild) {
            this.#logger.error(`${event} without guild`);
            return;
        }

        event = `${event} ${guildString(guild)}`;

        const guildSheo = this.#sheos.get(guild.id);
        if (!guildSheo) {
            this.#logger.error(`${event} with no corresponding sheo instance`);
            return;
        }

        const presenceUpdateExecutor = async () => {
            await guildSheo.presenceUpdate(oldPresence, newPresence, {
                guildMember: member,
                eid,
            });
        };
        this.#userUpdateQueue.push(member.id, presenceUpdateExecutor);
    }

    async #onMessageCreate(msg: Message) {
        if (!msg.content.startsWith("!sheo")) {
            return;
        }
        const event = "messageCreate";
        const guildId = msg.guild?.id;
        if (!guildId) {
            this.#logger.error(`${event} with no guild id`);
            return;
        }
        const guildSheo = this.#sheos.get(guildId);
        if (!guildSheo) {
            this.#logger.error(`${event} with no corresponding sheo instance`);
            return;
        }

        await guildSheo.onMessageCreate(msg);
    }

    async #readyGuild(guildId: string, config: DiscordStreamBotConfig) {
        this.#logger.info(`[guild: ${guildId}] fetching guild`);
        const guild = await this.#client.guilds.fetch(guildId);
        if (guild.id !== guildId) {
            this.#logger.error(`[guild: ${guildId}] found wrong guild: ${guild.id}`);
            return;
        }
        this.#logger.info(`${guildString(guild)} config: ${JSON.stringify(config)}`);

        const {
            cooldownInterval,
            name,
            streamingMembersChannelId,
            streamingRoleId,
            filter,
        } = config;
        const sheo = new DiscordSheo({
            client: this.#client,
            guild,
            cooldownInterval,
            name,
            streamingMembersChannelId,
            streamingRoleId,
            filter,
            readOnly: this.#readOnly,
        });
        this.#sheos.set(guild.id, sheo);

        await sheo.initialize();
    }

}
