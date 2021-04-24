import Discord from "discord.js";

// eslint-disable-next-line max-len
const TWITCH_URL = "https://twitch.tv/slaurent22";
const EMBED_COLOR = "#71368A";
const EMBED_AUTHOR = "slaurent22";

export function getTestEmbed({ logo, }: { logo: string }): Discord.MessageEmbed {
    return new Discord.MessageEmbed()
        .setColor("#0099ff")
        .setTitle("Stream Title Goes Here")
        .setURL(TWITCH_URL)
        .setAuthor("slaurent22", logo, TWITCH_URL)
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
    boxArtUrl: string|null;
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

export function getTwitchStreamEmbed({
    boxArtUrl,
    gameName,
    logo,
    startDate,
    thumbnailUrl,
    title,
}: TwitchStreamEmbedConfig): Discord.MessageEmbed {
    const embedThumbnail = boxArtUrl ?
        boxArtUrl.replace("{width}", "188").replace("{height}", "250") : logo;
    const embedImage = thumbnailUrl.replace("{width}", "440").replace("{height}", "248");
    const embedImageUrl = getEmbedImageUrl(embedImage);
    return new Discord.MessageEmbed()
        .setColor(EMBED_COLOR)
        .setTitle(title)
        .setURL(TWITCH_URL)
        .setAuthor(EMBED_AUTHOR, logo, TWITCH_URL)
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

export function getGuildMemberStreamingEmbed(
    guildMember: Discord.GuildMember,
    streamingActivity: Discord.Activity): Discord.MessageEmbed {

    const displayName = guildMember.displayName;
    const details = streamingActivity.details;
    const url = streamingActivity.url;
    const state = streamingActivity.state;

    const largeImageUrl = streamingActivity.assets?.largeImageURL();
    const smallImageURL = streamingActivity.assets?.smallImageURL();

    const embed = new Discord.MessageEmbed()
        .setTimestamp(new Date())
        .setAuthor(displayName);

    if (details) {
        embed.setTitle(details);
    }

    if (url) {
        embed.setURL(url);
    }

    if (largeImageUrl) {
        embed.setImage(getEmbedImageUrl(largeImageUrl));
    }

    if (smallImageURL) {
        embed.setThumbnail(getEmbedImageUrl(smallImageURL));
    }

    if (state) {
        embed.setFooter(state);
    }

    return embed;
}
