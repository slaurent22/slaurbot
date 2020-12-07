import Discord from "discord.js";

// eslint-disable-next-line max-len
const TWITCH_ICON_URL = "https://static-cdn.jtvnw.net/jtv_user_pictures/c9fc8693-5f6a-4c58-a3e3-09b8fa017d33-profile_image-70x70.png";
const TWITCH_URL = "https://twitch.tv/slaurent22";
const EMBED_COLOR = "#71368A";
const EMBED_AUTHOR = "slaurent22";

export function getTestEmbed(): Discord.MessageEmbed {
    return new Discord.MessageEmbed()
        .setColor("#0099ff")
        .setTitle("Stream Title Goes Here")
        .setURL(TWITCH_URL)
        .setAuthor("slaurent22", TWITCH_ICON_URL, TWITCH_URL)
        // .setDescription("Some description here")
        .setThumbnail(TWITCH_ICON_URL)
        .addFields(
            // { name: "Game", value: "Hollow Knight", },
            // { name: "\u200B", value: "\u200B", },
            { name: "Game", value: "Hollow Knight", inline: true, },
            { name: "Viewers", value: "69", inline: true, }
        )
        // .addField("Inline field title", "Some value here", true)
        .setImage(TWITCH_ICON_URL)
        .setTimestamp();
    // .setFooter("Some footer text here", IMAGE_URL);
}

interface TwitchStreamEmbedConfig {
    title: string;
    gameName: string;
    startDate: Date;
    boxArtUrl: string|null;
    thumbnailUrl: string;
}

// stick in url for cache-busting
function randomNumber(min: number, max: number): number {
    const r = Math.random() * (max - min) + min;
    return Math.floor(r);
}

export function getTwitchStreamEmbed({
    title, startDate, gameName, thumbnailUrl, boxArtUrl,
}: TwitchStreamEmbedConfig): Discord.MessageEmbed {
    const embedThumbnail = boxArtUrl ? boxArtUrl.replace("{width}", "188").replace("{height}", "250") : TWITCH_ICON_URL;
    const embedImage = thumbnailUrl.replace("{width}", "440").replace("{height}", "248");
    const embedImageUrl = `${embedImage}?r=${randomNumber(11111, 99999)}`;
    return new Discord.MessageEmbed()
        .setColor(EMBED_COLOR)
        .setTitle(title)
        .setURL(TWITCH_URL)
        .setAuthor(EMBED_AUTHOR, TWITCH_ICON_URL, TWITCH_URL)
        .setThumbnail(embedThumbnail)
        .addFields(
            { name: "Game", value: gameName, }
        )
        .setImage(embedImageUrl)
        .setTimestamp(startDate);
}

interface TwitchOfflineEmbedConfig {
    startDate: Date;
}
export function getTwitchOfflineEmbed({
    startDate,
}: TwitchOfflineEmbedConfig): Discord.MessageEmbed {
    return new Discord.MessageEmbed()
        .setColor(EMBED_COLOR)
        .setFooter("Stream went offline")
        .setTimestamp(startDate);
}
