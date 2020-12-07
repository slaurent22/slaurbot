import { Logger, LogLevel } from "@d-fischer/logger";

export function getLogger({ name, }: { name: string }): Logger {
    return new Logger({
        name,
        minLevel: LogLevel.DEBUG,
        colors: true,
        emoji: true,
        timestamps: true,
    });
}
