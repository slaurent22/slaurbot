export enum LogLevel {
    DEBUG = "DEBUG",
    INFO  = "INFO",
    WARN  = "WARN",
    ERROR = "ERROR",
    FATAL = "FATAL",
}

function logPrefix(level: LogLevel): string {
    return `[SLAURBOT] [${level}]`;
}

export function log(level: LogLevel, ...args: Array<unknown>): void {
    console.log(logPrefix(level), ...args);
}