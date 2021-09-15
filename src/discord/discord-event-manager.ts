import assert from "assert";
import type {
    Client as DiscordClient,
    Guild,
    MessageReaction,
    User as DiscordUser
} from "discord.js";
import {
    DISCORD_CHANNEL_ID,
    DISCORD_MESSAGE_ID,
    DISCORD_ROLE_REACT_MAP
} from "../util/constants";
import { getLogger } from "../util/logger";
import type { DiscordNotifier } from "./discord-notifier";

interface DiscordEventManagerConfig {
    discordClient: DiscordClient;
    discordNotifier: DiscordNotifier;
}

export class DiscordEventManager {
    private _discordClient: DiscordClient;
    private _discordNotifier: DiscordNotifier;
    private _guild: Guild;
    private _logger;

    constructor({
        discordClient,
        discordNotifier,
    }: DiscordEventManagerConfig) {
        this._discordClient = discordClient;
        this._discordNotifier = discordNotifier;
        this._logger = getLogger({
            name: "slaurbot-discord-event-manager",
        });

        const guilds = this._discordClient.guilds.cache.toJSON();
        this._guild = guilds[0];
    }

    public async listen(): Promise<void> {
        this._logger.info("listening to events");
        this._discordClient.on("debug", msg => {
            const message = `[client debug] ${msg}`;
            this._logger.debug(message);
        });

        this._discordClient.on("warn", msg => {
            const message = `[client warn] ${msg}`;
            this._logger.warn(message);
            void this._discordNotifier.sendJSONToTestChannel({ warn: msg, });
        });

        this._discordClient.on("userUpdate", (oldUser, newUser) => {
            this._logger.debug("userUpdate: " + newUser.id);
        });

        await this._awaitReactions();
    }

    private async _awaitReactions() {
        const roleRequestChannel = await this._discordClient.channels.fetch(DISCORD_CHANNEL_ID.ROLE_REQUEST);
        assert(roleRequestChannel && roleRequestChannel.isText());
        const roleReactMessage = await roleRequestChannel.messages.fetch(DISCORD_MESSAGE_ID.ROLE_REACT);

        const collector = roleReactMessage.createReactionCollector();

        collector.on("collect", this._onReactAdd.bind(this));
        collector.on("dispose", this._onReactRemove.bind(this));
        collector.on("remove", this._onReactRemove.bind(this));
        collector.on("end", () => {
            this._logger.warn("Reaction Collector received 'end' event");
        });
    }

    private async _onReactAdd(reaction: MessageReaction, user: DiscordUser) {
        this._logger.info(`ReactAdd: ${reaction.emoji.name} from ${user.tag}`);
        if (!reaction.emoji.name) {
            return;
        }
        const role = DISCORD_ROLE_REACT_MAP.get(reaction.emoji.name);
        if (!role) {
            this._logger.warn("No role for this reaction");
            return;
        }
        return this._addRoleToUser(role, user);
    }

    private async _onReactRemove(reaction: MessageReaction, user: DiscordUser) {
        this._logger.info(`ReactRemove: ${reaction.emoji.name} from ${user.tag}`);
        if (!reaction.emoji.name) {
            return;
        }
        const role = DISCORD_ROLE_REACT_MAP.get(reaction.emoji.name);
        if (!role) {
            this._logger.warn("No role for this reaction");
            return;
        }
        return this._removeRoleFromUser(role, user);
    }

    private async _addRoleToUser(role: string, user: DiscordUser) {
        try {
            const guildMember = await this._guild.members.fetch(user);
            await guildMember.roles.add(role);
            this._logger.info(`Added role ${role} for ${user.tag}`);
        }
        catch (e) {
            this._logger.error(`Adding role ${role} for ${user.tag} FAILED`);
            this._logger.error(e as string);
        }
    }

    private async _removeRoleFromUser(role: string, user: DiscordUser) {
        try {
            const guildMember = await this._guild.members.fetch(user);
            await guildMember.roles.remove(role);
            this._logger.info(`Removed role ${role} for ${user.tag}`);
        }
        catch (e) {
            this._logger.error(`Removing role ${role} for ${user.tag} FAILED`);
            this._logger.error(e as string);
        }
    }
}
