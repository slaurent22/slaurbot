/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */

import Discord from "discord.js";
import type { Logger } from "@d-fischer/logger/lib";
import { getLogger } from "../util/logger";
import { DiscordSheo } from "./discord-sheo";

export interface DiscordStreamBotConfig {
    cooldownInterval: number;
    name: string;
    streamingMembersChannelId?: string;
    streamingRoleId?: string;
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

    constructor(botToken: string, config: Map<string, DiscordStreamBotConfig>) {
        this.#botToken = botToken;
        this.#config = config;
        this.#logger = getLogger({ name: "streambot-sheo", });

        this.#client = new Discord.Client();
        this.#client.once("ready", this.#onReady.bind(this));
    }

    public async login(): Promise<void> {
        const loginResult = await this.#client.login(this.#botToken);
        if (loginResult !== this.#botToken) {
            this.#logger.warning("login return value does not match botToken");
        }
        else {
            this.#logger.info("Discord client has logged in");
        }
    }

    public destroy() {
        this.#logger.info("destroying");
        for (const sheo of this.#sheos.values()) {
            sheo.destroy();
        }
        this.#sheos.clear();
    }

    async #onReady() {
        this.#logger.info("Discord client is ready");
        await Promise.all([...this.#config.entries()].map(([g, c]) => this.#readyGuild(g, c)));
    }

    async #readyGuild(guildId: string, config: DiscordStreamBotConfig) {
        this.#logger.info(`[guild: ${guildId}] fetching guild`);
        const guild = await this.#client.guilds.fetch(guildId, true, true);
        if (guild.id !== guildId) {
            this.#logger.error(`[guild: ${guildId}] found wrong guild: ${guild.id}`);
            return;
        }
        this.#logger.info(`[guild:${guild.id} guild-name:${guild.name}] config: ${JSON.stringify(config)}`);

        const {
            cooldownInterval,
            name,
            streamingMembersChannelId,
            streamingRoleId,
        } = config;
        const sheo = new DiscordSheo({
            client: this.#client,
            guild,
            cooldownInterval,
            name,
            streamingMembersChannelId,
            streamingRoleId,
        });
        this.#sheos.set(guild.id, sheo);

        await sheo.initialize();
    }

}
