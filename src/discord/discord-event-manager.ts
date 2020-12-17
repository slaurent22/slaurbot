import assert from "assert";
import type { Client as DiscordClient, Presence } from "discord.js";
import { DISCORD_CHANNEL_ID, DISCORD_MESSAGE_ID } from "../util/constants";
import { getLogger } from "../util/logger";
import type { DiscordNotifier } from "./discord-notifier";

interface DiscordEventManagerConfig {
    discordClient: DiscordClient;
    discordNotifier: DiscordNotifier;
}

export class DiscordEventManager {
    private _discordClient: DiscordClient;
    private _discordNotifier: DiscordNotifier;
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
        const streamingAcitivity = newPresence.activities.find(activity => {
            if (activity.url === null) {
                return false;
            }
            return activity.type === "STREAMING" && activity.url.length > 0;
        });

        if (!streamingAcitivity) {
            return;
        }

        if (!streamingAcitivity.url) {
            return;
        }

        const message = {
            content: `${user.username} is streaming at ${streamingAcitivity.url}`,
        };

        await this._discordNotifier.notifyStreamingMembersChannel(message);
    }


    // TODO: Get users in reactions, update Discord roles
    private async _awaitReactions() {
        const roleRequestChannel = await this._discordClient.channels.fetch(DISCORD_CHANNEL_ID.ROLE_REQUEST);
        assert(roleRequestChannel.isText());
        const roleReactMessage = await roleRequestChannel.messages.fetch(DISCORD_MESSAGE_ID.ROLE_REACT);
        const reactions = roleReactMessage.reactions.cache.array();
        await this._discordNotifier.sendJSONToTestChannel({ reactions, });
    }
}
