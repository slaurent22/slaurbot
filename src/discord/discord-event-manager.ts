import assert from "assert";
import type {
    Activity,
    Client as DiscordClient,
    Guild,
    MessageReaction,
    Presence,
    User as DiscordUser
} from "discord.js";
import { DISCORD_CHANNEL_ID, DISCORD_MESSAGE_ID, DISCORD_ROLE_ID, DISCORD_ROLE_REACT_MAP, DISCORD_USER_ID } from "../util/constants";
import { getLogger } from "../util/logger";
import type { DiscordNotifier } from "./discord-notifier";

interface DiscordEventManagerConfig {
    discordClient: DiscordClient;
    discordNotifier: DiscordNotifier;
}

function getStreamingActivity(presence: Presence|undefined): Activity|null {
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

        const guilds = this._discordClient.guilds.cache.array();
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
            void this._discordNotifier.sendJSONToTestChannel({
                userUpdate: {
                    oldUser, newUser,
                },
            });
        });

        this._discordClient.on("presenceUpdate", (oldPresence: Presence|undefined, newPresence: Presence) => {
            this._logger.debug("_onPresenceUpdate: " + JSON.stringify({
                presenceUpdate: { oldPresence, newPresence, },
            }, null, 4));

            void this._onPresenceUpdate(oldPresence, newPresence);
        });

        await this._awaitReactions();
    }

    private async _onPresenceUpdate(oldPresence: Presence|undefined, newPresence: Presence) {
        const user = newPresence.user;
        if (!user) {
            this._logger.error("Presence event received without user");
            return;
        }

        if (user.id === DISCORD_USER_ID.SLAURENT) {
            this._logger.info("Ignoring presence update from slaurent");
            return;
        }

        const oldStreamingAcivity = getStreamingActivity(oldPresence);
        const newStreamingAcivity = getStreamingActivity(newPresence);

        if (oldStreamingAcivity) {
            this._logger.info("User was already streaming");
            return;
        }

        if (!newStreamingAcivity) {
            return;
        }

        if (!newStreamingAcivity.url) {
            return;
        }

        const message = {
            content: `${user.username} is streaming at ${newStreamingAcivity.url}`,
        };

        await this._discordNotifier.notifyStreamingMembersChannel(message);
    }

    private async _awaitReactions() {
        const roleRequestChannel = await this._discordClient.channels.fetch(DISCORD_CHANNEL_ID.ROLE_REQUEST);
        assert(roleRequestChannel.isText());
        const roleReactMessage = await roleRequestChannel.messages.fetch(DISCORD_MESSAGE_ID.ROLE_REACT);

        const collector = roleReactMessage.createReactionCollector(() => true, {
            dispose: true,
        });

        collector.on("collect", this._onReactAdd.bind(this));
        collector.on("dispose", this._onReactRemove.bind(this));
        collector.on("remove", this._onReactRemove.bind(this));
        collector.on("end", () => {
            this._logger.warn("Reaction Collector received 'end' event");
        });
    }

    private async _onReactAdd(reaction: MessageReaction, user: DiscordUser) {
        this._logger.info(`ReactAdd: ${reaction.emoji.name} from ${user.tag}`);
        const role = DISCORD_ROLE_REACT_MAP.get(reaction.emoji.name);
        if (!role) {
            this._logger.warn("No role for this reaction");
            return;
        }
        const guildMember = await this._guild.members.fetch(user);
        await guildMember.roles.add(role);
        this._logger.info(`Added role ${role} for ${user.tag}`);
    }

    private async _onReactRemove(reaction: MessageReaction, user: DiscordUser) {
        this._logger.info(`ReactRemove: ${reaction.emoji.name} from ${user.tag}`);
        const role = DISCORD_ROLE_REACT_MAP.get(reaction.emoji.name);
        if (!role) {
            this._logger.warn("No role for this reaction");
            return;
        }
        const guildMember = await this._guild.members.fetch(user);
        await guildMember.roles.remove(role);
        this._logger.info(`Removed role ${role} for ${user.tag}`);
    }
}
