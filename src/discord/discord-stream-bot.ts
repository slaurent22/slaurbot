/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */

import assert from "assert";
import Discord from "discord.js";
import type {
    Activity,
    Guild,
    Presence,
    User as DiscordUser
    , MessageEmbed, DMChannel, NewsChannel, TextChannel } from "discord.js";
import humanizeDuration from "humanize-duration";
import type { Logger } from "@d-fischer/logger/lib";
import { getLogger } from "../util/logger";
import { refreshed } from "../util/time-util";
import { PersistedMap } from "../util/persisted-map";
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
    #name: string;
    #membersStreamingCooldown = new Map<string, Date>();
    #streamingMembersChannel?: TextChannel | DMChannel | NewsChannel;
    #streamingMembersChannelId?: string;
    #streamingMessages?: PersistedMap<string, Discord.Message | undefined>;
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
        this.#name = name;
        this.#streamingMembersChannelId = streamingMembersChannelId;
        this.#streamingRoleId = streamingRoleId;

        this.#client = new Discord.Client();
        this.#client.once("ready", this.#onReady.bind(this));

        // this.#membersStreamingCooldown = new PersistedMap<string, Date>({
        //     name: `${name}-cooldownmap`,
        //     entries: [],
        //     keyParse: k=> k,
        //     valueParse: v => new Date(v),
        //     keySerialize: k => k,
        //     valueSerialize: v => String(v),
        // });
        // void this.#membersStreamingCooldown.read();
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
        // no-op
    }

    async #onReady() {
        this.#logger.info("Discord client is ready");
        this.#client.on("presenceUpdate", this.#onPresenceUpdate.bind(this));
        const guilds = this.#client.guilds.cache.array();
        this.#guild = guilds[0];
        if (this.#streamingMembersChannelId) {
            const channel = this.#client.channels.cache.get(this.#streamingMembersChannelId);
            if (!channel?.isText()) {
                this.#logger.error(`[channel:${this.#streamingMembersChannelId}] Failed to find text channel`);
                return;
            }
            this.#streamingMembersChannel = channel;
        }

        if (!this.#streamingMembersChannel) {
            return;
        }

        await this.#readStreamingMembersChannel();
        this.#streamingMessages = new PersistedMap({
            name: `${this.#name}-streaming-messages`,
            entries: [],
            keyParse: k => k,
            valueParse: v => this.#cachedMessageById(v),
            keySerialize: k => k,
            valueSerialize: v => v?.id ?? "undefined",
        });
        const initMap = await this.#streamingMessages.read();
        if (initMap) {
            for (const [userId, message] of initMap.entries()) {
                this.#logger.info(`[user:${userId}] ${message?.content}`);
            }
        }
    }

    #cachedMessageById(id: string): Discord.Message | undefined {
        if (!this.#streamingMembersChannel) {
            return undefined;
        }
        const messageManager = this.#streamingMembersChannel.messages;
        return messageManager.cache.get(id);
    }

    async #readStreamingMembersChannel() {
        if (!this.#streamingMembersChannel) {
            return;
        }
        let size = this.#streamingMembersChannel.messages.cache.size;
        this.#logger.info(`message cache has ${size} messages`);

        const messageManager = this.#streamingMembersChannel.messages;
        await messageManager.fetch({ limit: 100, });

        size = this.#streamingMembersChannel.messages.cache.size;
        this.#logger.info(`message cache has ${size} messages`);
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
        if (!this.#streamingMessages || !this.#streamingMembersChannel) {
            return;
        }

        const existingMessage = this.#streamingMessages.get(userId);
        if (existingMessage?.editable) {
            this.#logger.info(`[message:${existingMessage.id}] editing message`);
            const newMessage = await existingMessage.edit(message);
            this.#streamingMessages.set(userId, newMessage);
            return;
        }
        if (existingMessage && !existingMessage.editable) {
            this.#logger.info(`[message:${existingMessage.id}] deleting message`);
            await existingMessage.delete({
                reason: "message was not editable. reeplacing with new message",
            });
        }

        this.#streamingMessages.set(userId, await this.#streamingMembersChannel.send(message));
        await this.#streamingMessages.flush();
    }

    async #deleteStreamingMembersChannelMesssage(userId: string) {
        if (!this.#streamingMessages) {
            return;
        }
        const message = this.#streamingMessages.get(userId);
        if (!message) {
            return;
        }
        this.#logger.debug(`[user:${userId} message:${message.id}] deleting message`);
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
            await this.#streamingMessagesUpsert(user, newStreamingAcivity);
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

        await this.#streamingMessagesUpsert(user, newStreamingAcivity);
    }

    async #streamingMessagesUpsert(user: Discord.User, newStreamingAcivity: Discord.Activity) {
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
