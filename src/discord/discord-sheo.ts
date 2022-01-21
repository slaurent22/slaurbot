/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */
import assert from "assert";
import deepequal from "deepequal";
import type { Logger } from "@d-fischer/logger/lib";
import type {
    Activity,
    Client,
    Guild,
    Message,
    Presence,
    User,
    GuildMember,
    TextBasedChannels,
    MessageOptions
} from "discord.js";
import {
    DiscordAPIError
} from "discord.js";
import humanizeDuration from "humanize-duration";
import { getLogger } from "../util/logger";
import { PersistedMap } from "../util/persisted-map";
import { refreshed } from "../util/time-util";
import {
    discordUserString as du,
    guildMemberString as gm
} from "../util/log-strings";
import { getGuildMemberStreamingEmbed, pickFromActivity } from "./discord-embed";

export interface DiscordSheoConfig {
    client: Client;
    cooldownInterval: number;
    name: string;
    streamingMembersChannelId?: string;
    streamingRoleId?: string;
    guild: Guild;
    filter?: (activity: Activity, guildMember: GuildMember) => boolean;
}

function getStreamingActivity(presence: Presence | null): Activity | null {
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
    #streamingMembersChannel?: TextBasedChannels;
    #streamingMembersChannelId?: string;
    #streamingMessages?: PersistedMap<string, Message | undefined>;
    #streamingRoleId?: string;
    #guild: Guild;
    #filter: (activity: Activity, guildMember: GuildMember) => boolean;

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
                this.#logger.info(`[user:${userId}] [message:${message?.id}] ${message?.content}`);
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

    async #addRoleToUser(guildMember: GuildMember, {
        eid,
    }: {
        eid: string;
    }) {
        if (!this.#streamingRoleId) {
            return;
        }
        const role = this.#streamingRoleId;
        const action = `[${eid}] ${gm(guildMember)} Adding role ${role}`;
        this.#logger.info(action);
        try {
            const { id, } = await guildMember.roles.add(role);
            this.#logger.info(`${action} SUCCESS: [member:${id}]`);
        }
        catch (e) {
            this.#logger.error(`${action} FAILURE: ${(e as Error)?.message}`);
            this.#logger.error(e as string);
        }
    }

    async #removeRoleFromUser(guildMember: GuildMember, {
        eid,
    }: {
        eid: string;
    }) {
        if (!this.#streamingRoleId) {
            return;
        }
        const role = this.#streamingRoleId;
        const action = `[${eid}] ${gm(guildMember)} Removing role ${role}`;
        this.#logger.info(action);
        try {
            const { id, } = await guildMember.roles.remove(role);
            this.#logger.info(`${action} SUCCESS: [member:${id}]`);
        }
        catch (e) {
            this.#logger.error(`${action} FAILURE: ${(e as Error)?.message}`);
            this.#logger.error(e as string);
        }
    }

    async #notifyStreamingMembersChannel(message: MessageOptions, {
        userId, eid,
    }: {
        userId: string;
        eid: string;
    }): Promise<void> {
        if (!this.#streamingMessages || !this.#streamingMembersChannel) {
            return;
        }

        const event = `[${eid}] [user:${userId}]`;

        const existingMessage = this.#streamingMessages.get(userId);
        if (existingMessage?.editable) {
            const action = `${event} [message:${existingMessage.id}] editing message`;
            this.#logger.info(action);
            try {
                const newMessage = await existingMessage.edit(message);
                this.#streamingMessages.set(userId, newMessage);
                this.#logger.info(`${action} SUCCESS: [message:${newMessage.id}]`);
            }
            catch (e) {
                this.#logger.error(`${action} FAILURE: ${(e as Error)?.message}`);
                this.#logger.error(e as string);
            }

            return;
        }
        if (existingMessage && !existingMessage.editable) {
            const action = `${event} [message:${existingMessage.id}] deleting message`;
            this.#logger.info(action);
            try {
                const { id, } = await existingMessage.delete();
                this.#streamingMessages.delete(userId);
                this.#logger.info(`${action} SUCCESS: [message:${id}]`);
            }
            catch (e) {
                this.#logger.error(`${action} FAILURE: ${(e as Error)?.message}`);
                this.#logger.error(e as string);
            }
        }

        const action = `${event} posting new message`;
        try {
            this.#logger.info(action);
            const newMessage = await this.#streamingMembersChannel.send(message);
            this.#logger.info(`${action} SUCCESS: [message:${newMessage.id}]`);
            this.#streamingMessages.set(userId, newMessage);
        }
        catch (e) {
            this.#logger.error(`${action} FAILURE: ${(e as Error)?.message}`);
            this.#logger.error(e as string);
        }

        this.#logger.debug(`${event} flushing streamingMessages`);
        await this.#streamingMessages.flush();
    }

    async #deleteStreamingMembersChannelMesssage(userId: string, {
        eid,
    }: {
        eid: string;
    }) {
        if (!this.#streamingMessages) {
            return;
        }
        const event = `[${eid}] [user:${userId}]`;
        const message = this.#streamingMessages.get(userId);
        if (!message) {
            this.#logger.warn(`${event} no message found`);
            return;
        }
        const action = `${event} [message:${message.id}] deleting message`;
        try {
            this.#logger.info(action);
            const { id, } = await message.delete();
            this.#streamingMessages.delete(userId);
            this.#logger.info(`${action} SUCCESS: [message:${id}]`);
        }
        catch (e) {
            this.#logger.error(`${action} FAILURE: ${(e as Error)?.message}`);
            this.#logger.error(e as string);
        }

        this.#logger.debug(`${event} flushing streamingMessages`);
        await this.#streamingMessages.flush();
    }

    async presenceUpdateNoopTimeout(oldPresence: Presence | undefined, newPresence: Presence, {
        guildMember, eid,
    }: {
        guildMember: GuildMember;
        eid: string;
    }) {
        const user = guildMember.user;
        const event = `[${eid}] ${du(user)} presenceUpdate`;
        this.#logger.crit(`${event} NO-OP TIMEOUT START`);
        await new Promise<void>(resolve => {
            setTimeout(() => {
                this.#logger.crit(`${event} NO-OP TIMEOUT END`);
                resolve();
            }, 5000);
        });
    }

    async presenceUpdate(oldPresence: Presence | null, newPresence: Presence, {
        guildMember, eid,
    }: {
        guildMember: GuildMember;
        eid: string;
    }) {
        const user = guildMember.user;
        const event = `[${eid}] ${du(user)} presenceUpdate`;


        const oldStreamingAcivity = getStreamingActivity(oldPresence);
        const newStreamingAcivity = getStreamingActivity(newPresence);

        // still not streaming
        if (!oldStreamingAcivity && !newStreamingAcivity) {
            // no need to log this case
            return;
        }

        const remove = () => Promise.all([
            this.#removeRoleFromUser(guildMember, { eid, }),
            this.#deleteStreamingMembersChannelMesssage(user.id, { eid, })
        ]);

        // stopped streaming
        if (oldStreamingAcivity && !newStreamingAcivity) {
            const oldAllowable = this.#filter(oldStreamingAcivity, guildMember);
            this.#logger.debug(`${event} STOPPED STREAMING oldAllowable=${oldAllowable}`);
            if (oldAllowable) {
                // only need to remove if we had added in the first place
                await remove();
            }

            return;
        }

        // still streaming
        if (oldStreamingAcivity && newStreamingAcivity) {
            const oldAllowable = this.#filter(oldStreamingAcivity, guildMember);
            const letThrough = this.#filter(newStreamingAcivity, guildMember);
            if (!oldAllowable && !letThrough) {
                // no need to add or remove anything
                this.#logger.debug(`${event} doing nothing`);
                return;
            }
            this.#logger.debug(`${event} STILL STREAMING; letThrough=${letThrough}`);
            if (letThrough) {
                await this.#addRoleToUser(guildMember, { eid, });
                const shouldUpdate = shouldUpdateStreamingMessage(oldStreamingAcivity, newStreamingAcivity);
                this.#logger.info(`${event} STILL STREAMING; shouldUpdate=${shouldUpdate}`);
                if (shouldUpdate) {
                    await this.#streamingMessagesUpsert(guildMember, newStreamingAcivity, { eid, });
                }
            }
            else {
                this.#logger.debug(`${event} STILL STREAMING, but no longer allowable content`);
                await remove();
            }
            return;
        }

        // started streaming
        assert(newStreamingAcivity);

        if (!newStreamingAcivity.url) {
            this.#logger.info(`${event} STARTED STREAMING, but without a url`);
            await remove();
            return;
        }

        const letThrough = this.#filter(newStreamingAcivity, guildMember);
        if (!letThrough) {
            this.#logger.debug(`${event} STARTED STREAMING, but not allowable content`);
            return;
        }

        this.#logger.info(`${event} STARTED STREAMING`);

        await this.#addRoleToUser(guildMember, { eid, });

        if (!this.#streamingMembersChannel) {
            return;
        }

        const previousMesageDate = this.#membersStreamingCooldown.get(user.id);
        if (previousMesageDate && !refreshed(previousMesageDate, this.#cooldownInterval)) {
            this.#logger.warn(
                `${event} skipping message: ${user.tag} was already broadcasted to streaming members channel ` +
                `within the past ${humanizeDuration(this.#cooldownInterval)}`);
            return;
        }

        await this.#streamingMessagesUpsert(guildMember, newStreamingAcivity, { eid, });
    }

    async #streamingMessagesUpsert(guildMember: GuildMember, newStreamingAcivity: Activity, {
        eid,
    }: {
        eid: string;
    }) {
        const embed = getGuildMemberStreamingEmbed(guildMember, newStreamingAcivity);
        const displayName = guildMember.displayName;

        const message = {
            content: `**${displayName}** is now live!`,
            embeds: [embed],
        };
        await this.#notifyStreamingMembersChannel(message, {
            userId: guildMember.user.id, eid,
        });
        this.#membersStreamingCooldown.set(guildMember.user.id, new Date());
    }
}
