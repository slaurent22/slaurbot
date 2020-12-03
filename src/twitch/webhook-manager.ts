import type { ChatClient } from "twitch-chat-client/lib";
import type { ConnectCompatibleApp } from "twitch-webhooks";
import { EnvPortAdapter, WebHookListener } from "twitch-webhooks";
import type { ApiClient, HelixStream } from "twitch/lib";
import type { Channel as DiscordChannel, Client as DiscordClient } from "discord.js";
import { DISCORD_CHANNEL_ID, USER_ID } from "../util/constants";
import { getEnv } from "../util/env";
import { log, LogLevel } from "../util/logger";

export interface TwitchWebHookManagerConfig {
    apiClient: ApiClient;
    chatClient: ChatClient;
    discordClient: DiscordClient;
}

export class TwitchWebHookManager {
    private _apiClient: ApiClient;
    private _chatClient: ChatClient;
    private _discordClient: DiscordClient;
    private _listener: WebHookListener;

    constructor({
        apiClient,
        chatClient,
        discordClient,
    }: TwitchWebHookManagerConfig) {
        this._apiClient = apiClient;
        this._chatClient = chatClient;
        this._discordClient = discordClient;
        this._listener = new WebHookListener(this._apiClient, new EnvPortAdapter({
            hostName: "slaurbot.herokuapp.com",
        }), {
            logger: {
                name: "SLAURBOT",
                timestamps: true,
                minLevel: "DEBUG",
                colors: false,
            },
        });
    }

    public async listen(app: ConnectCompatibleApp): Promise<void> {
        const {
            TWITCH_CHANNEL_NAME: userName,
        } = getEnv();
        const userId = USER_ID.SLAURENT;

        this._listener.applyMiddleware(app);
        await Promise.all([
            this._subscribeToStreamChanges({ userId, userName, }),
            this._subscribeToFollowsToUser({ userId, userName, })
        ]);
    }

    private getDiscordStreamStatusChannel(): DiscordChannel|undefined {
        return this._discordClient.channels.cache.get(DISCORD_CHANNEL_ID.STREAM_STATUS);
    }

    private async _subscribeToStreamChanges({
        userId, userName,
    }: {
        userId: string; userName: string;
    }): Promise<void> {
        let prevStream = await this._apiClient.helix.streams.getStreamByUserId(userId);
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        await this._listener.subscribeToStreamChanges(userId, async(stream?: HelixStream) => {
            log(LogLevel.INFO, "Stream Change:", stream);
            let message = "stream status updated";
            if (stream && !prevStream) {
                if (!prevStream) {
                    const game = await stream.getGame();
                    const gameName = game ? game.name : "<unknown game>";
                    const gameId = game ? game.id : "<unknown id>";
                    const {
                        userDisplayName,
                        startDate,
                    } = stream;
                    log(LogLevel.INFO, {
                        userDisplayName,
                        userId,
                        startDate,
                        gameName,
                        gameId,
                    });
                    message = `${userName} went playing ${gameName}: "${stream.title}"`;
                }
            }
            else {
                // no stream, no display name
                message = `${userName} just went offline`;
            }
            prevStream = stream ? stream : null;

            const discordChannel = this.getDiscordStreamStatusChannel();
            if (discordChannel && discordChannel.isText()) {
                await discordChannel.send(message);
            }
        });
    }

    private async _subscribeToFollowsToUser({
        userId, userName,
    }: {
        userId: string;
        userName: string;
    }): Promise<void> {
        await this._listener.subscribeToFollowsToUser(userId, (follow) => {
            log(LogLevel.INFO, "Follow:", follow);
            this._chatClient.say(userName, `@${follow.userDisplayName} thank you for the follow!`);
        });
    }
}
