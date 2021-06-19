/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */

import type { Logger } from "@d-fischer/logger/lib";
import type { Redis } from "ioredis";
import { getLogger } from "./logger";
import { createRedis } from "./redis";

type Parser<T> = (s: string) => T;
type Serializer<T> = (t: T) => string;

function toMap<K, V>(
    record: Record<string, string>,
    keyParse: Parser<K>,
    valueParse: Parser<V>
): Map<K, V> {
    const map = new Map<K, V>();
    for (const [k, v] of Object.entries(record)) {
        map.set(keyParse(k), valueParse(v));
    }
    return map;
}

function parse<K, V>(
    str: string,
    keyParse: Parser<K>,
    valueParse: Parser<V>
): Map<K, V> {
    const objParsed = JSON.parse(str) as Record<string, string>;
    return toMap(objParsed, keyParse, valueParse);
}

function toRecord<K, V>(
    map: Map<K, V>,
    keySerialize: Serializer<K>,
    valueSerialize: Serializer<V>
): Record<string, string> {
    const record = {} as Record<string, string>;
    for (const [k, v] of map.entries()) {
        record[keySerialize(k)] = valueSerialize(v);
    }
    return record;
}

function serialize<K, V>(
    map: Map<K, V>,
    keySerialize: Serializer<K>,
    valueSerialize: Serializer<V>
): string {
    const record = toRecord(map, keySerialize, valueSerialize);
    return JSON.stringify(record);
}

export class PersistedMap<K, V> {
    #kp: Parser<K>;
    #vp: Parser<V>;
    #ks: Serializer<K>;
    #vs: Serializer<V>;
    #map: Map<K, V>;
    #name: string;
    #redis: Redis;
    #logger: Logger;

    constructor({
        name,
        entries,
        keyParse,
        valueParse,
        keySerialize,
        valueSerialize,
    }: {
        name: string;
        entries: Array<[K, V]>;
        keyParse: Parser<K>;
        valueParse: Parser<V>;
        keySerialize: Serializer<K>;
        valueSerialize: Serializer<V>;
    }) {
        this.#logger = getLogger({ name: `pmap-${name}`, });
        this.#map = new Map(entries);
        this.#name = `object-${name}`;
        this.#redis = createRedis();

        this.#kp = keyParse;
        this.#vp = valueParse;
        this.#ks = keySerialize;
        this.#vs = valueSerialize;
    }

    has(key: K): boolean {
        return this.#map.has(key);
    }

    get(key: K) {
        return this.#map.get(key);
    }

    set(key: K, value: V) {
        return this.#map.set(key, value);
    }

    delete(key: K) {
        return this.#map.delete(key);
    }

    get size() {
        return this.#map.size;
    }

    async flush() {
        this.#logger.info("flushing to redis cache");
        const record = serialize(this.#map, this.#ks, this.#vs);
        this.#logger.debug(JSON.stringify({ record, }));
        const status = await this.#redis.hmset(this.#name, { record, });
        if (status !== "OK") {
            this.#logger.error(status);
        }
    }

    async read(): Promise<Map<K, V> | null> {
        const [record] = await this.#redis.hmget(this.#name, "record");
        if (record === null) {
            return null;
        }
        this.#map = parse(record, this.#kp, this.#vp);
        return this.#map;
    }

    async dispose() {
        this.#map.clear();
        await this.#redis.quit();
    }
}
