/** Small, fast, seedable PRNG (mulberry32). Deterministic runs make AI training reproducible. */
export class Rng {
  private current: number;

  constructor(seed: number) {
    this.current = seed >>> 0 || 0x9e3779b9;
  }

  /** Internal state, for serializing a generator over the network. */
  get state(): number {
    return this.current;
  }

  set state(value: number) {
    this.current = value | 0;
  }

  next(): number {
    let t = (this.current = (this.current + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  sign(): 1 | -1 {
    return this.next() < 0.5 ? -1 : 1;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    let total = 0;
    for (const [, w] of entries) total += w;
    let roll = this.next() * total;
    for (const [item, w] of entries) {
      roll -= w;
      if (roll <= 0) return item;
    }
    return entries[entries.length - 1][0];
  }

  /** Approximately normal distribution (mean 0, std 1). */
  gaussian(): number {
    const u = Math.max(1e-9, this.next());
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
}
