import { Logger } from "@d-fischer/logger/lib";
import type { Client as DiscordClient, Presence } from "discord.js";
import { getLogger } from "../util/logger";
import { DiscordNotifier } from "./discord-notifier";

interface DiscordEventManagerConfig {
    discordClient: DiscordClient;
}

export class DiscordEventManager {
    private _discordClient: DiscordClient;
    private _discordNotifier: DiscordNotifier;
    private _logger;

    constructor({
        discordClient,
    }: DiscordEventManagerConfig) {
        this._discordClient = discordClient;
        this._discordNotifier = new DiscordNotifier({ discordClient, });
        this._logger = getLogger({
            name: "slaurbot-discord-event-manager",
        });
    }

    public listen(): void {
        this._logger.info("listening to events");
        this._discordClient.on("debug", msg => {
            const message = `[client debug] ${msg}`;
            this._logger.debug(message);
        });

        this._discordClient.on("warn", msg => {
            const message = `[client warn] ${msg}`;
            this._logger.warn(message);
            void this._discordNotifier.notifyTestChannel({ content: "`" + message + "`", });
        });

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this._discordClient.on("userUpdate", async(oldUser, newUser) => {
            this._logger.info("userUpdate: " + newUser.id);
            await this._discordNotifier.sendJSONToTestChannel({
                userUpdate: {
                    oldUser, newUser,
                },
            });
        });

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this._discordClient.on("presenceUpdate", async(oldPresence: Presence|undefined, newPresence: Presence) => {
            this._logger.info("_onPresenceUpdate: " + newPresence.userID);
            await this._discordNotifier.sendJSONToTestChannel({
                presenceUpdate: { oldPresence, newPresence, },
            });
        });
    }
}
