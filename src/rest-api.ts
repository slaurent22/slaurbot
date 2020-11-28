import got from "got";
import { REST_API_URLS } from "./constants";
import { log, LogLevel } from "./logger";

interface GetStringResponseParams {
    restApiUrl: string; errorMessage: string;
}

interface FfzRoomResponse {
    sets: Record<string, {
        emoticons: Array<{
            id: number;
            name: string;
        }>;
    }>;
}

async function getStringResponse({
    restApiUrl, errorMessage,
}: GetStringResponseParams): Promise<string> {
    try {
        const response = await got<string>(restApiUrl);
        return response.body;
    }
    catch (e) {
        log(LogLevel.ERROR, errorMessage, e);
        return errorMessage;
    }
}

export async function getBttvEmotes(): Promise<string> {
    return getStringResponse({
        restApiUrl: REST_API_URLS.GET.BTTV_EMOTES,
        errorMessage: "Error fetching BTTV emotes",
    });
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
    catch {
        return "Error retrieving FFZ emotes";
    }
}
