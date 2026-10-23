// A localStorage that lives in memory, one for each device in a test
export class MemoryStorage implements Storage {
    private readonly map = new Map<string, string>();

    get length() {
        return this.map.size;
    }

    clear() {
        this.map.clear();
    }

    getItem(key: string) {
        return this.map.has(key) ? (this.map.get(key) as string) : null;
    }

    key(index: number) {
        return [...this.map.keys()][index] ?? null;
    }

    removeItem(key: string) {
        this.map.delete(key);
    }

    setItem(key: string, value: string) {
        this.map.set(key, String(value));
    }

    has(key: string) {
        return this.map.has(key);
    }
}
