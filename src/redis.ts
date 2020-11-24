import { getEnv } from "./env";
import Redis from "ioredis";


export function createRedis(): Redis.Redis {
    const {
        REDIS_URL
    } = getEnv();
    const redis = new Redis(REDIS_URL);
    return redis;
}