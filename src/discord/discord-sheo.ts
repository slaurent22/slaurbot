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
    GuildMember,
    TextBasedChannel,
    BaseMessageOptions,
    PartialGuildMember
} from "discord.js";
import {
    ActivityType,
    ChannelType
} from "discord.js";
import humanizeDuration from "humanize-duration";
import { getLogger } from "../util/logger";
import { PersistedMap } from "../util/persisted-map";
import { refreshed } from "../util/time-util";
import {
    discordUserString as du,
    guildMemberString as gm
} from "../util/log-strings";
import { DISCORD_USER_ID } from "../util/constants";
import { getGuildMemberStreamingEmbed, pickFromActivity } from "./discord-embed";

export interface DiscordStreamBotConfig {
    cooldownInterval: number;
    name: string;
    streamingMembersChannelId?: string;
    streamingRoleId?: string;
    filter?: (activity: Activity, guildMember: GuildMember) => boolean;
    modRole?: string;
    messageTemplate?: string;
}

export interface DiscordSheoConfig extends DiscordStreamBotConfig {
    client: Client;
    guild: Guild;
    readOnly: boolean;
}

function getStreamingActivity(presence: Presence | null): Activity | null {
    if (!presence) {
        return null;
    }

    const streamingAcitivity = presence.activities.find(activity => {
        if (activity.url === null) {
            return false;
        }
        return activity.type === ActivityType.Streaming && activity.url.length > 0;
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
    #streamingMembersChannel?: TextBasedChannel;
    #streamingMembersChannelId?: string;
    #streamingMessages?: PersistedMap<string, Message | undefined>;
    #streamingRoleId?: string;
    #guild: Guild;
    #filter: (activity: Activity, guildMember: GuildMember) => boolean;
    #readOnly: boolean;
    #modRole?: string;
    #messageTemplate: string;

    constructor({
        client,
        cooldownInterval,
        name,
        streamingMembersChannelId,
        streamingRoleId,
        guild,
        filter,
        readOnly,
        modRole,
        messageTemplate,
    }: DiscordSheoConfig) {
        this.#cooldownInterval = cooldownInterval;
        this.#guild = guild;
        this.#name = name;
        this.#logger = getLogger({ name: `sheo-${guild.id}-${name}`, });

        this.#streamingMembersChannelId = streamingMembersChannelId;
        this.#streamingRoleId = streamingRoleId;

        this.#client = client;
        this.#filter = filter ?? (() => true);

        this.#readOnly = readOnly;

        this.#modRole = modRole;

        this.#messageTemplate = messageTemplate ?? "**$displayName** is now live!";

        this.#logger.info("sheo created" + (this.#readOnly ? ": SHEO_READ_ONLY" : ""));
    }

    public async initialize() {
        if (this.#streamingMembersChannelId) {
            const channel = this.#client.channels.cache.get(this.#streamingMembersChannelId);
            if (channel?.type !== ChannelType.GuildText) {
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

    async onMessageCreate(msg: Message) {
        if (msg.content === "!sheo-ping") {
            return msg.reply("sheo pong!");
        }
        if (msg.content === "!sheo-pong") {
            return msg.reply("sheo ping!");
        }
        const parsedCleanCommand = /^!sheo-clean (?<userId>\w+)/.exec(msg.content);
        if (parsedCleanCommand && parsedCleanCommand.groups) {
            const { userId, } = parsedCleanCommand.groups;
            return this.#processSheoCleanCommand(msg, userId);
        }
    }

    async onGuildMemberRemove(guildMember: GuildMember | PartialGuildMember, { eid, }: { eid: string }) {
        if (this.#streamingMessages?.get(guildMember.user.id)) {
            await this.#deleteStreamingMembersChannelMesssage(guildMember.user.id, { eid, });
        }
    }

    async #processSheoCleanCommand(msg: Message, targetUserId: string) {
        try {
            const commandUserGuildMember = await this.#guild.members.fetch(msg.author);
            let allowed = msg.author.id === DISCORD_USER_ID.SLAURENT;
            if (this.#modRole) {
                allowed = allowed || commandUserGuildMember.roles.cache.has(this.#modRole);
            }
            if (!allowed) {
                return msg.reply("You are not allowed to use !sheo-clean");
            }
            await this.#cleanupUser(targetUserId);
            return msg.reply("Success");
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        catch (e: any) {
            this.#logger.error(`sheo-clean error: ${(e && e.message) ?? "unknown error"}`);
            return msg.reply(`Error: ${(e && e.message) ?? "unknown. Check logs."}`);
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
        if (this.#readOnly) {
            this.#logger.info(`${action} SHEO_READ_ONLY: bailing out`);
            return;
        }
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
        if (this.#readOnly) {
            this.#logger.info(`${action} SHEO_READ_ONLY: bailing out`);
            return;
        }
        try {
            const { id, } = await guildMember.roles.remove(role);
            this.#logger.info(`${action} SUCCESS: [member:${id}]`);
        }
        catch (e) {
            this.#logger.error(`${action} FAILURE: ${(e as Error)?.message}`);
            this.#logger.error(e as string);
        }
    }

    async #notifyStreamingMembersChannel(message: BaseMessageOptions, {
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
            if (this.#readOnly) {
                this.#logger.info(`${action} SHEO_READ_ONLY: bailing out`);
                return;
            }
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
            if (this.#readOnly) {
                this.#logger.info(`${action} SHEO_READ_ONLY: bailing out`);
                return;
            }
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
        if (this.#readOnly) {
            this.#logger.info(`${action} SHEO_READ_ONLY: bailing out`);
            return;
        }
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
            if (this.#streamingMessages.has(userId)) {
                const action = `${event} removing falsy value from messages map`;
                this.#logger.info(action);
                if (this.#readOnly) {
                    this.#logger.info(`${action} SHEO_READ_ONLY: bailing out`);
                    return;
                }
                this.#streamingMessages.delete(userId);
                await this.#streamingMessages.flush();
            }
            return;
        }
        const action = `${event} [message:${message.id}] deleting message`;
        if (this.#readOnly) {
            this.#logger.info(`${action} SHEO_READ_ONLY: bailing out`);
            return;
        }
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
        this.#logger.info("avatarURL: " + JSON.stringify({
            16: guildMember.avatarURL({ size: 16, }),
            32: guildMember.avatarURL({ size: 32, }),
            64: guildMember.avatarURL({ size: 64, }),
            128: guildMember.avatarURL({ size: 128, }),
            256: guildMember.avatarURL({ size: 256, }),
            512: guildMember.avatarURL({ size: 512, }),
            1024: guildMember.avatarURL({ size: 1024, }),
            2048: guildMember.avatarURL({ size: 2048, }),
            4096: guildMember.avatarURL({ size: 4096, }),
            undefined: guildMember.avatarURL({}),
            no_options: guildMember.avatarURL({}),
        }));
        this.#logger.info("displayAvatarURL: " + JSON.stringify({
            16: guildMember.displayAvatarURL({ size: 16, }),
            32: guildMember.displayAvatarURL({ size: 32, }),
            64: guildMember.displayAvatarURL({ size: 64, }),
            128: guildMember.displayAvatarURL({ size: 128, }),
            256: guildMember.displayAvatarURL({ size: 256, }),
            512: guildMember.displayAvatarURL({ size: 512, }),
            1024: guildMember.displayAvatarURL({ size: 1024, }),
            2048: guildMember.displayAvatarURL({ size: 2048, }),
            4096: guildMember.displayAvatarURL({ size: 4096, }),
            undefined: guildMember.displayAvatarURL({}),
            no_options: guildMember.displayAvatarURL({}),
        }));
        this.#logger.info(`avatar: ${guildMember.avatar}`);
        const message = {
            content: this.#streamingMessageContent(guildMember, newStreamingAcivity),
            embeds: [embed],
        };
        await this.#notifyStreamingMembersChannel(message, {
            userId: guildMember.user.id, eid,
        });
        this.#membersStreamingCooldown.set(guildMember.user.id, new Date());
    }

    #streamingMessageContent(guildMember: GuildMember, activity: Activity) {
        return this.#messageTemplate
            .replace("$displayName", guildMember.displayName)
            .replace("$state", activity.state as string);
    }

    async #cleanupGuildMember(guildMember: GuildMember) {
        await Promise.all([
            this.#removeRoleFromUser(guildMember, { eid: "cleanup", }),
            this.#deleteStreamingMembersChannelMesssage(guildMember.user.id, { eid: "cleanup", })
        ]);
    }

    async #cleanupUser(userId: string) {
        this.#logger.info("cleanup userId: " + userId);
        const guildMember = await this.#guild.members.fetch(userId);
        await this.#cleanupGuildMember(guildMember);
    }
}
