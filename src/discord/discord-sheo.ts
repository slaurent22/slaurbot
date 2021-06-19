/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */
import assert from "assert";
import deepequal from "deepequal";
import type { Logger } from "@d-fischer/logger/lib";
import type {
    Activity,
    Client,
    DMChannel,
    Guild,
    MessageEmbed,
    Message,
    NewsChannel,
    Presence,
    TextChannel,
    User,
    GuildMember } from "discord.js";
import {
    DiscordAPIError
} from "discord.js";
import humanizeDuration from "humanize-duration";
import { getLogger } from "../util/logger";
import { PersistedMap } from "../util/persisted-map";
import { refreshed } from "../util/time-util";
import { getGuildMemberStreamingEmbed, pickFromActivity } from "./discord-embed";

interface MessageConfig {
    content: string;
    embed?: MessageEmbed;
}

export interface DiscordSheoConfig {
    client: Client;
    cooldownInterval: number;
    name: string;
    streamingMembersChannelId?: string;
    streamingRoleId?: string;
    guild: Guild;
    filter?: (activity: Activity) => boolean;
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

function shouldUpdateStreamingMessage(oldActivity: Activity, newActivity: Activity): boolean {
    const oldInfo = pickFromActivity(oldActivity);
    const newInfo = pickFromActivity(newActivity);
    return !deepequal(oldInfo, newInfo, true);
}

export class DiscordSheo {
    #client: Client;
    #cooldownInterval: number;
    #logger: Logger;
    #name: string;
    #membersStreamingCooldown = new Map<string, Date>();
    #streamingMembersChannel?: TextChannel | DMChannel | NewsChannel;
    #streamingMembersChannelId?: string;
    #streamingMessages?: PersistedMap<string, Message | undefined>;
    #streamingRoleId?: string;
    #guild: Guild;
    #filter: (activity: Activity) => boolean;

    constructor({
        client,
        cooldownInterval,
        name,
        streamingMembersChannelId,
        streamingRoleId,
        guild,
        filter,
    }: DiscordSheoConfig) {
        this.#cooldownInterval = cooldownInterval;
        this.#guild = guild;
        this.#name = name;
        this.#logger = getLogger({ name: `sheo-${guild.id}-${name}`, });

        this.#streamingMembersChannelId = streamingMembersChannelId;
        this.#streamingRoleId = streamingRoleId;

        this.#client = client;
        this.#filter = filter ?? (() => true);

        this.#logger.info("sheo created");
    }

    public async initialize() {
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

    async destroy() {
        this.#logger.info("destroying");
        if (this.#streamingMessages) {
            await this.#streamingMessages.flush();
            await this.#streamingMessages.dispose();
        }
    }

    #cachedMessageById(id: string): Message | undefined {
        if (!this.#streamingMembersChannel) {
            return undefined;
        }
        const messageManager = this.#streamingMembersChannel.messages;
        return messageManager.cache.get(id);
    }

    async getGuildMember(user: User): Promise<GuildMember | null> {
        let guildMember: GuildMember | null = null;
        try {
            guildMember = await this.#guild.members.fetch(user);
        }
        catch (e) {
            if (e instanceof DiscordAPIError && e.message.includes("Unknown Member")) {
                return null;
            }
            throw e;
        }
        return guildMember;
    }


    async #readStreamingMembersChannel() {
        if (!this.#streamingMembersChannel) {
            return;
        }

        const messageManager = this.#streamingMembersChannel.messages;
        await messageManager.fetch({ limit: 100, });

        const size = this.#streamingMembersChannel.messages.cache.size;
        this.#logger.info(`read ${size} messages from streaming members channel`);
    }

    async #addRoleToUser(guildMember: GuildMember) {
        if (!this.#streamingRoleId) {
            return;
        }
        const role = this.#streamingRoleId;
        try {
            await guildMember.roles.add(role);
            this.#logger.info(`Added role ${role} for ${guildMember.displayName}`);
        }
        catch (e) {
            this.#logger.error(`Adding role ${role} for ${guildMember.displayName} FAILED`);
            this.#logger.error(e);
        }
    }

    async #removeRoleFromUser(guildMember: GuildMember) {
        if (!this.#streamingRoleId) {
            return;
        }
        const role = this.#streamingRoleId;
        try {
            await guildMember.roles.remove(role);
            this.#logger.info(`Removed role ${role} for ${guildMember.displayName}`);
        }
        catch (e) {
            this.#logger.error(`Removing role ${role} for ${guildMember.displayName} FAILED`);
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
            this.#streamingMessages.delete(userId);
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
        this.#streamingMessages.delete(userId);
        await this.#streamingMessages.flush();
    }

    async presenceUpdate(oldPresence: Presence | undefined, newPresence: Presence, {
        guildMember,
    }: {guildMember: GuildMember}) {
        const user = guildMember.user;
        this.#logger.trace(`[presence] presenceUpdate user: ${guildMember.user.tag}`);

        const oldStreamingAcivity = getStreamingActivity(oldPresence);
        const newStreamingAcivity = getStreamingActivity(newPresence);

        // still not streaming
        if (!oldStreamingAcivity && !newStreamingAcivity) {
            // no need to log this case
            return;
        }

        const remove = () => Promise.all([
            this.#removeRoleFromUser(guildMember),
            this.#deleteStreamingMembersChannelMesssage(user.id)
        ]);

        // stopped streaming
        if (oldStreamingAcivity && !newStreamingAcivity) {
            this.#logger.info(`[presence] ${user.id} ${user.tag} is no longer streaming`);
            await remove();
            return;
        }

        // still streaming
        if (oldStreamingAcivity && newStreamingAcivity) {
            const letThrough = this.#filter(newStreamingAcivity);
            this.#logger.info(`[presence] ${user.id} ${user.tag} is still streaming; letThrough=${letThrough}`);
            if (letThrough) {
                await this.#addRoleToUser(guildMember);
                const shouldUpdate = shouldUpdateStreamingMessage(oldStreamingAcivity, newStreamingAcivity);
                this.#logger.info(`[presence] ${user.id} ${user.tag} is still streaming; shouldUpdate=${shouldUpdate}`);
                if (shouldUpdate) {
                    await this.#streamingMessagesUpsert(guildMember, newStreamingAcivity);
                }
            }
            else {
                this.#logger.info(`[presence] ${user.id} ${user.tag} removing`);
                await remove();
            }
            return;
        }

        assert(newStreamingAcivity, `[presence] ${user.id} if newStreamingAcivity is null, logic is broken`);

        if (!newStreamingAcivity.url) {
            this.#logger.info(`[presence] ${user.id} ${user.tag} is streaming, but without a url`);
            await remove();
            return;
        }

        const letThrough = this.#filter(newStreamingAcivity);
        if (!letThrough) {
            this.#logger.info(`[presence] ${user.id} ${user.tag}: activity filtered out`);
            return;
        }

        await this.#addRoleToUser(guildMember);

        if (!this.#streamingMembersChannel) {
            return;
        }

        const previousMesageDate = this.#membersStreamingCooldown.get(user.id);
        if (previousMesageDate && !refreshed(previousMesageDate, this.#cooldownInterval)) {
            this.#logger.warn(
                `[presence] skipping message: ${user.tag} was already broadcasted to streaming members channel ` +
                `within the past ${humanizeDuration(this.#cooldownInterval)}`);
            return;
        }

        await this.#streamingMessagesUpsert(guildMember, newStreamingAcivity);
    }

    async #streamingMessagesUpsert(guildMember: GuildMember, newStreamingAcivity: Activity) {
        const embed = getGuildMemberStreamingEmbed(guildMember, newStreamingAcivity);
        const displayName = guildMember.displayName;
        const state = newStreamingAcivity.state;
        const stateDisplay = state ? ` **${state}**` : "";

        const message = {
            content: `${displayName} is streaming${stateDisplay}`,
            embed,
        };
        await this.#notifyStreamingMembersChannel(message, guildMember.user.id);
        this.#membersStreamingCooldown.set(guildMember.user.id, new Date());
    }
}
