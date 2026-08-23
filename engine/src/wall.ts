import { TOTAL_TILES, type TileInstance } from './tiles.js';

/** Deterministic PRNG (mulberry32) so simulations are reproducible. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The wall. Tiles are drawn from the front; replacement tiles (for flowers,
 * animals and kongs) come from the back. The last `unplayable` tiles can never
 * be drawn from the front, but replacement draws DO NOT eat into that reserve
 * either in this model: the source says the unplayable tiles "yield no
 * replacement tiles". So both ends stop when they meet the reserve.
 */
export class Wall {
  private tiles: TileInstance[];
  private front = 0;           // next index for a normal draw
  private back: number;        // next index for a replacement draw (moves down)
  readonly unplayable: number;

  constructor(rng: () => number, unplayable = 15) {
    const t: TileInstance[] = [];
    for (let i = 0; i < TOTAL_TILES; i++) t.push(i);
    for (let i = t.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [t[i], t[j]] = [t[j]!, t[i]!];
    }
    this.tiles = t;
    this.unplayable = unplayable;
    this.back = t.length - 1;
  }

  /** Tiles still drawable from the front (excludes the unplayable reserve). */
  get remaining(): number {
    return Math.max(0, this.back - this.front + 1 - this.unplayable);
  }
  get isExhausted(): boolean { return this.remaining <= 0; }
  /** Every tile still in the wall, reserve included. For conservation checks. */
  get totalLeft(): number { return this.back - this.front + 1; }
  /** Ground truth: full shuffled order and the live cursors. Never expose to a player-visible state. */
  snapshot(): { order: TileInstance[]; front: number; back: number; unplayable: number } {
    return { order: [...this.tiles], front: this.front, back: this.back, unplayable: this.unplayable };
  }

  draw(): TileInstance | null {
    if (this.isExhausted) return null;
    return this.tiles[this.front++]!;
  }
  /** Replacement draw from the back. Same reserve applies. */
  drawReplacement(): TileInstance | null {
    if (this.isExhausted) return null;
    return this.tiles[this.back--]!;
  }
  /** Deal n tiles from the front (initial deal). */
  dealMany(n: number): TileInstance[] {
    const out: TileInstance[] = [];
    for (let i = 0; i < n; i++) { const t = this.draw(); if (t === null) break; out.push(t); }
    return out;
  }
}
