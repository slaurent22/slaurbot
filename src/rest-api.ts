import got from "got";
import { REST_API_URLS } from "./constants";
import { log, LogLevel } from "./logger";

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

export async function getBttvEmotes(): Promise<string> {
    try {
        const { emotes, } = await got(REST_API_URLS.GET.BTTV_EMOTES).json<BttvRoomResponse>();
        log(LogLevel.DEBUG, emotes);
        return emotes.map(({ code, }) => code).join(" ");
    }
    catch (e) {
        log(LogLevel.DEBUG, e);
        return "Error retrieving BTTV emotes";
    }
}

export async function getFfzEmotes(): Promise<string> {
    try {
        const { sets, } = await got(REST_API_URLS.GET.FFZ_EMOTES).json<FfzRoomResponse>();
        const emoteNames = [] as Array<string>;
        for (const { emoticons, } of Object.values(sets)) {
            log(LogLevel.DEBUG, emoticons.map(({ id, name, })=> ({ id, name, })));
            emoticons.forEach(emoticon => {
                emoteNames.push(emoticon.name);
            });
        }
        return emoteNames.join(" ");

    }
    catch (e) {
        log(LogLevel.DEBUG, e);
        return "Error retrieving FFZ emotes";
    }
}
