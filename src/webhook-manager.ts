import { ChatClient } from "twitch-chat-client/lib";
import { EnvPortAdapter, WebHookListener } from "twitch-webhooks";
import { ApiClient, HelixStream } from "twitch/lib";
import { USER_ID } from "./constants";
import { getEnv } from "./env";
import { log, LogLevel } from "./logger";

export interface WebHookManagerConfig {
    apiClient: ApiClient;
    chatClient: ChatClient;
}

export class WebHookManager {
    private _apiClient: ApiClient;
    private _chatClient: ChatClient;
    private _listener: WebHookListener;

    constructor({
        apiClient,
        chatClient,
    }: WebHookManagerConfig) {
        this._apiClient = apiClient;
        this._chatClient = chatClient;
        this._listener = new WebHookListener(this._apiClient, new EnvPortAdapter({
            hostName: "slaurbot.herokuapp.com",
        }), {
            logger: {
                name: "SLAURBOT",
                timestamps: true,
                minLevel: "DEBUG",
                colors: false,
            }
        });
    }

    public async listen(): Promise<void> {
        const {
            CHANNEL_NAME: userName
        } = getEnv();
        const userId = USER_ID.SLAURENT;

        await this._listener.listen();
        await Promise.all([
            this._subscribeToStreamChanges({ userId, userName }),
            this._subscribeToFollowsToUser({ userId, userName })
        ]);
    }

    private async _subscribeToStreamChanges({
        userId, userName
    }: {
        userId: string; userName: string;
    }): Promise<void> {
        let prevStream = await this._apiClient.helix.streams.getStreamByUserId(userId);
        await this._listener.subscribeToStreamChanges(userId, async (stream?: HelixStream) => {
            log(LogLevel.INFO, "Stream Change:", stream);
            if (stream && !prevStream) {
                if (!prevStream) {
                    const game = await stream.getGame();
                    const gameName = game ? game.name : "<unknown game>";
                    const gameId = game ? game.id : "<unknown id>";
                    const {
                        userDisplayName,
                        userId,
                        startDate
                    } = stream;
                    log(LogLevel.INFO, {
                        userDisplayName,
                        userId,
                        startDate,
                        gameName,
                        gameId
                    });
                    this._chatClient.say(userName,`${userName} went playing ${gameName}: "${stream.title}"`);
                }
            }
            else {
                // no stream, no display name
                log(LogLevel.INFO, `${userName} just went offline`);
            }
            prevStream = stream ? stream : null;
        });
    }

    private async _subscribeToFollowsToUser({
        userId, userName
    }: {
        userId: string;
        userName: string;
    }): Promise<void> {
        await this._listener.subscribeToFollowsToUser(userId, (follow) => {
            log(LogLevel.INFO, "Follow:", follow);
            this._chatClient.say(userName,`@${follow.userDisplayName} thank you for the follow!`);
        });
    }
}