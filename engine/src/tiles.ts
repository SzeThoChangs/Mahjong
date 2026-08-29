/**
 * Tile model for Singapore Mahjong (148 tiles).
 *
 * Two layers:
 *  - `TileKind` (0..45): the 46 distinct tile faces. All pattern logic works on kinds.
 *  - `TileInstance` (0..147): a physical tile. The wall and hands track instances.
 *
 * Kind layout:
 *   0-8   Wan 1-9      9-17  Tong 1-9     18-26 Sok 1-9
 *   27-30 Winds E S W N            31-33 Dragons Red Green White
 *   34-37 Flowers (seat 0-3)       38-41 Seasons (seat 0-3)
 *   42-45 Animals cat mouse rooster centipede
 *   46    Joker (wild tile, optional; 4 instances 148-151 exist only when the table plays with jokers)
 */

export type TileKind = number;
export type TileInstance = number;

export const SUITS = ['wan', 'tong', 'sok'] as const;
export type Suit = (typeof SUITS)[number];

export const WINDS = ['E', 'S', 'W', 'N'] as const;
export const DRAGONS = ['R', 'G', 'Wh'] as const;
export const FLOWERS = ['plum', 'orchid', 'chrysanthemum', 'bamboo'] as const;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export const ANIMALS = ['cat', 'mouse', 'rooster', 'centipede'] as const;

export const KIND = {
  WAN: 0, TONG: 9, SOK: 18,
  WIND: 27, DRAGON: 31,
  FLOWER: 34, SEASON: 38, ANIMAL: 42, JOKER: 46,
  COUNT: 47,
  STANDARD_COUNT: 34, // kinds 0..33 have 4 copies and form hands
} as const;

/** the standard Singapore set; jokers (instances 148..151) are added on top when the table uses them */
export const TOTAL_TILES = 148;
/** the usual number of wildcards; tables that play more pass their own count to `Wall` */
export const JOKER_COUNT = 4;
/** the most wildcards any table may play. INSTANCE_KIND is built to this, so instances
 *  148..(148+JOKER_MAX-1) are all jokers and a wall simply takes the first `count` of them. */
export const JOKER_MAX = 16;
export const TOTAL_TILES_WITH_JOKERS = TOTAL_TILES + JOKER_COUNT;

export function suitOf(k: TileKind): Suit | null {
  if (k < 9) return 'wan';
  if (k < 18) return 'tong';
  if (k < 27) return 'sok';
  return null;
}
/** 1..9 for suited tiles, else 0 */
export function rankOf(k: TileKind): number {
  return k < 27 ? (k % 9) + 1 : 0;
}
export const isSuited = (k: TileKind) => k < 27;
export const isWind = (k: TileKind) => k >= 27 && k < 31;
export const isDragon = (k: TileKind) => k >= 31 && k < 34;
export const isHonour = (k: TileKind) => k >= 27 && k < 34;
export const isStandard = (k: TileKind) => k < 34;
export const isFlower = (k: TileKind) => k >= 34 && k < 38;
export const isSeason = (k: TileKind) => k >= 38 && k < 42;
export const isAnimal = (k: TileKind) => k >= 42 && k < 46;
export const isJoker = (k: TileKind) => k === 46;
/** flowers, seasons, animals - set aside on draw (jokers are NOT bonus: they stay in the hand) */
export const isBonus = (k: TileKind) => k >= 34 && k < 46;
export const isTerminal = (k: TileKind) => isSuited(k) && (rankOf(k) === 1 || rankOf(k) === 9);
/** Terminal or honour - the "All-Terminal" / "Half-Terminal" family uses this. */
export const isTerminalOrHonour = (k: TileKind) => isTerminal(k) || isHonour(k);

/** Seat index 0..3 (E S W N) a flower/season belongs to, or -1. */
export function bonusSeat(k: TileKind): number {
  if (isFlower(k)) return k - KIND.FLOWER;
  if (isSeason(k)) return k - KIND.SEASON;
  return -1;
}
/** Animal pairs: cat<->mouse, rooster<->centipede */
export function animalPartner(k: TileKind): TileKind | -1 {
  if (!isAnimal(k)) return -1;
  const i = k - KIND.ANIMAL;
  return KIND.ANIMAL + (i ^ 1);
}

export function windKind(seat: number): TileKind { return KIND.WIND + seat; }
export function suitedKind(suit: Suit, rank: number): TileKind {
  return SUITS.indexOf(suit) * 9 + (rank - 1);
}

/** The 13 Wonders tile set: 1/9 of each suit + 7 honours. */
export const THIRTEEN_WONDER_KINDS: readonly TileKind[] = [
  0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33,
];

/** Map each instance id to its kind. Standard tiles: 4 each; bonus: 1 each; then JOKER_MAX jokers.
 *  Jokers sit LAST and all share one kind, so a wall that wants fewer just stops earlier - instances
 *  0..147 keep their meaning whatever the table's wildcard count. */
export const INSTANCE_KIND: readonly TileKind[] = (() => {
  const out: TileKind[] = [];
  for (let k = 0; k < KIND.STANDARD_COUNT; k++) for (let c = 0; c < 4; c++) out.push(k);
  for (let k = KIND.FLOWER; k < KIND.JOKER; k++) out.push(k);
  if (out.length !== TOTAL_TILES) throw new Error(`expected ${TOTAL_TILES} tiles, got ${out.length}`);
  for (let c = 0; c < JOKER_MAX; c++) out.push(KIND.JOKER);
  return out;
})();
export const kindOf = (t: TileInstance): TileKind => INSTANCE_KIND[t]!;

/** Human-readable short names, e.g. "5w" "3t" "9s" "E" "R" "F1" "A:cat". */
export function kindName(k: TileKind): string {
  if (isSuited(k)) return `${rankOf(k)}${suitOf(k)![0]}`;
  if (isWind(k)) return WINDS[k - KIND.WIND]!;
  if (isDragon(k)) return DRAGONS[k - KIND.DRAGON]!;
  if (isFlower(k)) return `F${k - KIND.FLOWER + 1}`;
  if (isSeason(k)) return `S${k - KIND.SEASON + 1}`;
  if (isJoker(k)) return 'J';
  return `A:${ANIMALS[k - KIND.ANIMAL]}`;
}

/** Parse short names like "1w 2w 3w E E" into kinds. Tolerant of commas. */
export function parseKinds(s: string): TileKind[] {
  return s.split(/[\s,]+/).filter(Boolean).map(parseKind);
}
export function parseKind(tok: string): TileKind {
  const m = /^([1-9])([wts])$/.exec(tok);
  if (m) return suitedKind(({ w: 'wan', t: 'tong', s: 'sok' } as const)[m[2] as 'w' | 't' | 's'], Number(m[1]));
  const wi = (WINDS as readonly string[]).indexOf(tok); if (wi >= 0) return KIND.WIND + wi;
  const di = (DRAGONS as readonly string[]).indexOf(tok); if (di >= 0) return KIND.DRAGON + di;
  const f = /^F([1-4])$/.exec(tok); if (f) return KIND.FLOWER + Number(f[1]) - 1;
  const se = /^S([1-4])$/.exec(tok); if (se) return KIND.SEASON + Number(se[1]) - 1;
  if (tok === 'J') return KIND.JOKER;
  const a = /^A:(\w+)$/.exec(tok);
  if (a) { const ai = (ANIMALS as readonly string[]).indexOf(a[1]!); if (ai >= 0) return KIND.ANIMAL + ai; }
  throw new Error(`bad tile token: ${tok}`);
}

/** Counts array over the 34 standard kinds. */
export type Counts = Uint8Array;
export function countsOf(kinds: Iterable<TileKind>): Counts {
  const c = new Uint8Array(KIND.STANDARD_COUNT);
  for (const k of kinds) { if (!isStandard(k)) throw new Error(`non-standard tile in hand counts: ${kindName(k)}`); c[k]!++; }
  return c;
}
/** Split a hand into standard-tile counts and the number of jokers. */
export function countsAndJokers(kinds: Iterable<TileKind>): { counts: Counts; jokers: number } {
  const c = new Uint8Array(KIND.STANDARD_COUNT); let j = 0;
  for (const k of kinds) { if (isJoker(k)) j++; else if (isStandard(k)) c[k]!++; else throw new Error(`non-hand tile in counts: ${kindName(k)}`); }
  return { counts: c, jokers: j };
}
