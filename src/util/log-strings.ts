import type { GuildMember, User } from "discord.js";

export function guildMemberString(guildMember: GuildMember): string {
    return `[member:${guildMember.id} ${guildMember.displayName}]`;
}

export function discordUserString(discordUser: User): string {
    return `[user:${discordUser.id}] [tag:${discordUser.tag}]`;
}
