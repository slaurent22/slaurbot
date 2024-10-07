import Redis from "ioredis";
import { getEnv } from "./env";


export function createRedis(): Redis.Redis {
    const {
        REDIS_URL,
    } = getEnv();
    const redis = new Redis(REDIS_URL, {
        tls: {
            rejectUnauthorized: false,
        },
    });
    return redis;
}
