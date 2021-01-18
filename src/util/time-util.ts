export function refreshed(lastUse: Date|undefined, cooldownMs: number): boolean {
    if (!lastUse) {
        return true;
    }
    return Number(new Date()) - Number(lastUse) > cooldownMs;
}
