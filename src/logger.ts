// is this shadowing `LogLevel` that comes out of the twitch package?
// eslint-disable-next-line no-shadow
export enum LogLevel {
    DEBUG = "DEBUG",
    INFO  = "INFO",
    WARN  = "WARN",
    ERROR = "ERROR",
    FATAL = "FATAL",
}

function logPrefix(level: LogLevel): string {
    const now = new Date();
    return `[${now.toISOString()}]    [SLAURBOT:${level}]`;
}

export function log(level: LogLevel, ...args: Array<unknown>): void {
    console.log(logPrefix(level), ...args);
}
