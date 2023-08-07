import type { Activity, GuildMember } from "discord.js";
import { EmbedBuilder, escapeMarkdown } from "discord.js";
import { STREAMING_PRESENCE_COLOR_RGB } from "../util/constants";

// eslint-disable-next-line max-len
const TWITCH_URL = "https://twitch.tv/slaurent22";
const EMBED_COLOR = "#71368A";
const EMBED_AUTHOR = "slaurent22";

export function getTestEmbed({ logo, }: { logo: string }): EmbedBuilder {
    return new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle("Stream Title Goes Here")
        .setURL(TWITCH_URL)
        .setAuthor({
            name: "slaurent22",
            iconURL: logo,
            url: TWITCH_URL,
        })
        // .setDescription("Some description here")
        .setThumbnail(logo)
        .addFields(
            // { name: "Game", value: "Hollow Knight", },
            // { name: "\u200B", value: "\u200B", },
            { name: "Game", value: "Hollow Knight", inline: true, },
            { name: "Viewers", value: "69", inline: true, }
        )
        // .addField("Inline field title", "Some value here", true)
        .setImage(logo)
        .setTimestamp();
    // .setFooter("Some footer text here", IMAGE_URL);
}

interface TwitchStreamEmbedConfig {
    boxArtUrl: string | null;
    gameName: string;
    logo: string;
    startDate: Date;
    thumbnailUrl: string;
    title: string;
}

// stick in url for cache-busting
function randomNumber(min: number, max: number): number {
    const r = Math.random() * (max - min) + min;
    return Math.floor(r);
}

function getEmbedImageUrl(imageUrl: string): string {
    return `${imageUrl}?r=${randomNumber(11111, 99999)}`;
}

function escape(text: string | null): string | null {
    if (!text) {
        return text;
    }
    return escapeMarkdown(text);
}

export function getTwitchStreamEmbed({
    boxArtUrl,
    logo,
    startDate,
    thumbnailUrl,
    title,
}: TwitchStreamEmbedConfig): EmbedBuilder {
    const embedThumbnail = boxArtUrl ?
        boxArtUrl.replace("{width}", "188").replace("{height}", "250") : logo;
    const embedImage = thumbnailUrl.replace("{width}", "440").replace("{height}", "248");
    const embedImageUrl = getEmbedImageUrl(embedImage);
    return new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle(escape(title) as string)
        .setURL(TWITCH_URL)
        .setAuthor({
            name: EMBED_AUTHOR,
            iconURL: logo,
            url: TWITCH_URL,
        })
        .setThumbnail(embedThumbnail)
        .setImage(embedImageUrl)
        .setTimestamp(startDate);
}

export function pickFromActivity(streamingActivity: Activity): {
    details: string | null;
    url: string | null;
    state: string | null;
    imageURL: string | null;
} {
    const details = escape(streamingActivity.details);
    const url = streamingActivity.url;
    const state = streamingActivity.state;

    let imageURL = streamingActivity.assets?.largeImage ?? null;
    if (imageURL && /^twitch:/.test(imageURL)) {
        imageURL = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${imageURL.slice(7)}.png`;
    }


    return {
        details, url, state, imageURL,
    };
}

interface TwitchOfflineEmbedConfig {
    startDate: Date;
}
export function getTwitchOfflineEmbed({
    startDate,
}: TwitchOfflineEmbedConfig): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setFooter({ text: "Stream went offline", })
        .setTimestamp(startDate);
}

export function getGuildMemberStreamingEmbed(
    guildMember: GuildMember,
    streamingActivity: Activity): EmbedBuilder {

    const author = guildMember.user.username;
    const {
        details, url, state, imageURL,
    } = pickFromActivity(streamingActivity);

    const embed = new EmbedBuilder()
        .setColor(STREAMING_PRESENCE_COLOR_RGB)
        .setTimestamp(new Date())
        .setAuthor({ name: author, });

    if (details) {
        embed.setTitle(details);
    }

    if (url) {
        embed.setURL(url);
    }

    if (imageURL) {
        embed.setThumbnail(getEmbedImageUrl(imageURL));
    }

    if (state) {
        embed.setFooter({ text: state, });
    }

    return embed;
}
