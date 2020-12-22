import got from "got";
import { REST_API_URLS } from "../util/constants";
import { getLogger } from "../util/logger";

interface FfzRoomResponse {
    sets: Record<string, {
        emoticons: Array<{
            id: number;
            name: string;
        }>;
    }>;
}

interface BttvRoomResponse {
    emotes: Array<{
        id: string;
        code: string;
    }>;
}

const logger = getLogger({
    name: "slaurbot-rest-api",
});

export async function getTwitchBttvEmotes(): Promise<string> {
    try {
        const { emotes, } = await got(REST_API_URLS.GET.BTTV_EMOTES).json<BttvRoomResponse>();
        logger.debug(JSON.stringify(emotes));
        return emotes.map(({ code, }) => code).join(" ");
    }
    catch (e) {
        logger.error(String(e));
        return "Error retrieving BTTV emotes";
    }
}

export async function getTwitchFfzEmotes(): Promise<string> {
    try {
        const { sets, } = await got(REST_API_URLS.GET.FFZ_EMOTES).json<FfzRoomResponse>();
        const emoteNames = [] as Array<string>;
        for (const { emoticons, } of Object.values(sets)) {
            logger.debug(JSON.stringify(emoticons.map(({ id, name, })=> ({ id, name, }))));
            emoticons.forEach(emoticon => {
                emoteNames.push(emoticon.name);
            });
        }
        return emoteNames.join(" ");

    }
    catch (e) {
        logger.error(String(e));
        return "Error retrieving FFZ emotes";
    }
}

export async function getPretzelNowPlaying(): Promise<string> {
    try {
        const response = await got(REST_API_URLS.GET.PRETZEL_NOW_PLAYING);
        logger.info("response: " + response.body);
        logger.info("rawBody: " + String(response.rawBody));
        return response.body;
    }
    catch (e) {
        return "Error retrieving current song";
    }
}
