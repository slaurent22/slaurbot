import Discord from "discord.js";

// eslint-disable-next-line max-len
const IMAGE_URL = "https://static-cdn.jtvnw.net/jtv_user_pictures/c9fc8693-5f6a-4c58-a3e3-09b8fa017d33-profile_image-70x70.png";
const TWITCH_URL = "https://twitch.tv/slaurent22";
const EMBED_COLOR = "#71368A";
const EMBED_AUTHOR = "slaurent22";

export function getTestEmbed(): Discord.MessageEmbed {
    return new Discord.MessageEmbed()
        .setColor("#0099ff")
        .setTitle("Stream Title Goes Here")
        .setURL(TWITCH_URL)
        .setAuthor("slaurent22", IMAGE_URL, TWITCH_URL)
        // .setDescription("Some description here")
        .setThumbnail(IMAGE_URL)
        .addFields(
            // { name: "Game", value: "Hollow Knight", },
            // { name: "\u200B", value: "\u200B", },
            { name: "Game", value: "Hollow Knight", inline: true, },
            { name: "Viewers", value: "69", inline: true, }
        )
        // .addField("Inline field title", "Some value here", true)
        .setImage(IMAGE_URL)
        .setTimestamp();
    // .setFooter("Some footer text here", IMAGE_URL);
}

interface StreamEmbedConfig {
    title: string;
    gameName: string;
    startDate: Date;
}

export function getTwitchStreamEmbed({
    title, startDate, gameName,
}: StreamEmbedConfig): Discord.MessageEmbed {
    return new Discord.MessageEmbed()
        .setColor(EMBED_COLOR)
        .setTitle(title)
        .setURL(TWITCH_URL)
        .setAuthor(EMBED_AUTHOR, IMAGE_URL, TWITCH_URL)
        .setThumbnail(IMAGE_URL)
        .addFields(
            { name: "Game", value: gameName, }
        )
        .setImage(IMAGE_URL)
        .setTimestamp(startDate);
}
