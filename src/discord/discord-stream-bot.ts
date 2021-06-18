/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */

import assert from "assert";
import Discord from "discord.js";
import type {
    Activity,
    Guild,
    Presence,
    User as DiscordUser
    , MessageEmbed } from "discord.js";
import humanizeDuration from "humanize-duration";
import type { Logger } from "@d-fischer/logger/lib";
import { getLogger } from "../util/logger";
import { refreshed } from "../util/time-util";
import { getGuildMemberStreamingEmbed } from "./discord-embed";

interface MessageConfig {
    content: string;
    embed?: MessageEmbed;
}

interface DiscordStreamBotConfig {
    botToken: string;
    cooldownInterval: number;
    name: string;
    streamingMembersChannelId?: string;
    streamingRoleId?: string;
}

function getStreamingActivity(presence: Presence | undefined): Activity | null {
    if (!presence) {
        return null;
    }

    const streamingAcitivity = presence.activities.find(activity => {
        if (activity.url === null) {
            return false;
        }
        return activity.type === "STREAMING" && activity.url.length > 0;
    });

    if (!streamingAcitivity) {
        return null;
    }

    return streamingAcitivity;
}

/**
 * A generic bot that can post a message and add a role while a Discord member
 * is streaming
 */
export class DiscordStreamBot {
    #botToken: string;
    #client: Discord.Client;
    #cooldownInterval: number;
    #guild?: Guild;
    #logger: Logger;
    #membersStreamingCooldown = new Map<string, Date>();
    #streamingMembersChannel?: Discord.Channel;
    #streamingMembersChannelId?: string;
    #streamingMessages = new Map<string, Discord.Message>();
    #streamingRoleId?: string;

    constructor({
        streamingMembersChannelId,
        botToken,
        name,
        cooldownInterval,
        streamingRoleId,
    }: DiscordStreamBotConfig) {
        this.#botToken = botToken;
        this.#cooldownInterval = cooldownInterval;
        this.#logger = getLogger({ name, });
        this.#streamingMembersChannelId = streamingMembersChannelId;
        this.#streamingRoleId = streamingRoleId;

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

    #onReady() {
        this.#logger.info("Discord client is ready");
        this.#client.on("presenceUpdate", this.#onPresenceUpdate.bind(this));
        const guilds = this.#client.guilds.cache.array();
        this.#guild = guilds[0];
        if (this.#streamingMembersChannelId) {
            this.#streamingMembersChannel = this.#client.channels.cache.get(this.#streamingMembersChannelId);
        }
    }

    async #addRoleToUser(user: DiscordUser) {
        if (!this.#streamingRoleId) {
            return;
        }
        const role = this.#streamingRoleId;
        try {
            assert(this.#guild);
            const guildMember = await this.#guild.members.fetch(user);
            await guildMember.roles.add(role);
            this.#logger.info(`Added role ${role} for ${user.tag}`);
        }
        catch (e) {
            this.#logger.error(`Adding role ${role} for ${user.tag} FAILED`);
            this.#logger.error(e);
        }
    }

    async #removeRoleFromUser(user: DiscordUser) {
        if (!this.#streamingRoleId) {
            return;
        }
        const role = this.#streamingRoleId;
        try {
            assert(this.#guild);
            const guildMember = await this.#guild.members.fetch(user);
            await guildMember.roles.remove(role);
            this.#logger.info(`Removed role ${role} for ${user.tag}`);
        }
        catch (e) {
            this.#logger.error(`Removing role ${role} for ${user.tag} FAILED`);
            this.#logger.error(e);
        }
    }

    async #notifyStreamingMembersChannel(message: MessageConfig, userId: string): Promise<void> {
        if (this.#streamingMessages.has(userId)) {
            await this.#deleteStreamingMembersChannelMesssage(userId);
        }
        if (this.#streamingMembersChannel && this.#streamingMembersChannel.isText()) {
            const discordMessage = await this.#streamingMembersChannel.send(message);
            this.#streamingMessages.set(userId, discordMessage);
        }
        else {
            this.#logger.error("DiscordNotifier: Streaming Members Channel not found");
        }
    }

    async #deleteStreamingMembersChannelMesssage(userId: string) {
        const message = this.#streamingMessages.get(userId);
        if (!message) {
            return;
        }
        await message.delete({
            reason: "user stopped streaming",
        });
    }

    async #onPresenceUpdate(oldPresence: Presence | undefined, newPresence: Presence) {
        const user = newPresence.user;
        if (!user) {
            this.#logger.error("[presence] presenceUpdate event received without newPresence.user");
            return;
        }

        this.#logger.debug(`[presence] presenceUpdate user: ${user.tag}`);

        const oldStreamingAcivity = getStreamingActivity(oldPresence);
        const newStreamingAcivity = getStreamingActivity(newPresence);

        // still not streaming
        if (!oldStreamingAcivity && !newStreamingAcivity) {
            // no need to log this case
            return;
        }

        // still streaming
        if (oldStreamingAcivity && newStreamingAcivity) {
            this.#logger.info(`[presence] ${user.id} ${user.tag} is still streaming`);
            return;
        }

        // stopped streaming
        if (oldStreamingAcivity && !newStreamingAcivity) {
            this.#logger.info(`[presence] ${user.id} ${user.tag} is no longer streaming`);
            await Promise.all([
                this.#removeRoleFromUser(user),
                this.#deleteStreamingMembersChannelMesssage(user.id)
            ]);
            return;
        }

        assert(newStreamingAcivity, `[presence] ${user.id} if newStreamingAcivity is null, logic is broken`);

        if (!newStreamingAcivity.url) {
            this.#logger.info(`[presence] ${user.id} ${user.tag} is streaming, but without a url`);
            return;
        }

        await this.#addRoleToUser(user);

        const previousMesageDate = this.#membersStreamingCooldown.get(user.id);
        if (previousMesageDate && !refreshed(previousMesageDate, this.#cooldownInterval)) {
            this.#logger.warn(
                `[presence] skipping message: ${user.tag} was already broadcasted to streaming members channel ` +
                `within the past ${humanizeDuration(this.#cooldownInterval)}`);
            return;
        }

        assert(this.#guild);
        const guildMember = await this.#guild.members.fetch(user);
        const embed = getGuildMemberStreamingEmbed(guildMember, newStreamingAcivity);
        const displayName = guildMember.displayName;
        const state = newStreamingAcivity.state;
        const stateDisplay = state ? ` **${state}**` : "";

        const message = {
            content: `${displayName} is streaming${stateDisplay}`,
            embed,
        };

        await this.#notifyStreamingMembersChannel(message, user.id);
        this.#membersStreamingCooldown.set(user.id, new Date());
    }

}
