import type { Guild, GuildMember, User } from "discord.js";

export function guildMemberString(guildMember: GuildMember): string {
    return `[member:${guildMember.id} ${guildMember.displayName}]`;
}

export function discordUserString(discordUser: User): string {
    return `[user:${discordUser.id}] [tag:${discordUser.tag}]`;
}

export function guildString(guild: Guild): string {
    return `[guild:${guild.id} ${guild.name}]`;
}
