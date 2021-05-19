import { Logger } from "@d-fischer/logger";
import { getEnv } from "./env";

export function getLogger({ name, }: { name: string }): Logger {
    const { LOG_LEVEL, } = getEnv();
    const logger = new Logger({
        name,
        minLevel: LOG_LEVEL,
        colors: false,
        emoji: true,
        timestamps: true,
    });
    logger.info(`Created logger with LOG_LEVEL=${LOG_LEVEL}`);
    return logger;
}
