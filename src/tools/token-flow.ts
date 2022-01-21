/* eslint-disable @typescript-eslint/no-unused-vars */
import assert from "assert";
import https from "https";
import dotenv from "dotenv";
import axios from "axios";
import { getTwitchTokens, writeTwitchTokens } from "../twitch/twitch-token-cache";

// Refer to
// https://dev.twitch.tv/docs/authentication/getting-tokens-oauth#oauth-authorization-code-flow

const BOT_USER = "slaurbot";

const REDIRECT_URI = "http://localhost";

const RESPONSE_TYPE = "code";

const SCOPE_LIST = [
    "analytics:read:extensions",
    "analytics:read:games",
    "bits:read",
    "channel:edit:commercial",
    "channel:manage:broadcast",
    "channel:manage:extensions",
    "channel:manage:redemptions",
    "channel:read:hype_train",
    "channel:read:redemptions",
    "channel:read:stream_key",
    "channel:read:subscriptions",
    "clips:edit",
    "moderation:read",
    "user:edit",
    "user:edit:follows",
    "user:read:broadcast",
    "user:read:email",
    "channel:moderate",
    "chat:edit",
    "chat:read",
    "whispers:read",
    "whispers:edit"
];

const SCOPES = SCOPE_LIST.join("+");

// eslint-disable-next-line max-len
const OAUTH2_AUTHORIZE_URL_TEMPLATE = `https://id.twitch.tv/oauth2/authorize?client_id=%client_id&redirect_uri=${REDIRECT_URI}&response_type=${RESPONSE_TYPE}&scope=${SCOPES}`;

function createFirstStepUrl({
    client_id,
}: {
    client_id: string;
}) {

    return OAUTH2_AUTHORIZE_URL_TEMPLATE.replace("%client_id", client_id);
}

function step1() {
    assert(process.env.TWITCH_CLIENT_ID);

    const {
        TWITCH_CLIENT_ID,
    } = process.env;

    const url = createFirstStepUrl({ client_id: TWITCH_CLIENT_ID, });
    console.log(`Log in as ${BOT_USER} and enter this URL:`);
    console.log(url);
}

// eslint-disable-next-line max-len
const OAUTH2_TOKEN_URL_TEMPLATE = `https://id.twitch.tv/oauth2/token?client_id=%client_id&client_secret=%client_secret&code=%code&grant_type=authorization_code&redirect_uri=${REDIRECT_URI}`;

function createSecondStepUrl({
    client_id,
    client_secret,
    code,
}: {
    client_id: string;
    client_secret: string;
    code: string;
}) {

    return OAUTH2_TOKEN_URL_TEMPLATE
        .replace("%client_id", client_id)
        .replace("%client_secret", client_secret)
        .replace("%code", code);
}

function step2() {
    const code = process.argv[2];
    assert(code);

    assert(process.env.TWITCH_CLIENT_ID);
    assert(process.env.TWITCH_CLIENT_SECRET);

    const {
        TWITCH_CLIENT_ID,
        TWITCH_CLIENT_SECRET,
    } = process.env;

    const url = createSecondStepUrl({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        code,
    });

    console.log("Making a POST request to this url; copy the response into tokens.json");
    console.log(url);
    // const response = https.request({ method: "POST", path: url, }, postResponse => {
    //     console.log(postResponse);
    // });

    axios.post(url)
        .then(response => {
            if (axios.isAxiosError(response)) {
                console.log(response.toJSON());
            }
            else {
                console.log(response);
            }
        })
        .catch(error => {
            console.log(error);
        });


}

interface Tokens {
    access_token: string;
    refresh_token: string;
    scope: Array<string>;
    expires_in: number;
}

async function step3() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { access_token, refresh_token, scope, expires_in, } = require("../../tokens.json") as Tokens;

    await writeTwitchTokens({
        accessToken: access_token,
        refreshToken: refresh_token,
        scope,
        expiresIn: expires_in,
        obtainmentTimestamp: Date.now(),
    });

    const tokenData = await getTwitchTokens();

    console.log("Redis twitchTokens:");
    console.log(tokenData);
}

function main() {
    dotenv.config();

    // step1();
    // step2();
    void step3();
}

main();
