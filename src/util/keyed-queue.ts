/* eslint-disable @typescript-eslint/explicit-member-accessibility */
import Queue from "queue";

export default class KeyedQueue<K, V> {
    #queues = new Map<K, Queue>();
    push(key: K, executor: (...args: Array<unknown>) => Promise<V>): void {
        let q = this.#queues.get(key);
        if (!q) {
            q = new Queue({
                autostart: true,
                concurrency: 1,
            });
            this.#queues.set(key, q);
        }
        q.push(executor);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(key: K, event: string | symbol, listener: (...args: any[]) => void): this {
        const q = this.#queues.get(key);
        if (!q) {
            return this;
        }
        q.on(event, listener);
        return this;
    }
}
