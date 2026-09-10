import { kindName, type TileKind } from 'sg-mahjong-engine';
import { asset } from './asset';

/**
 * Faces come from /tiles by default, and from an embedded map when there is one.
 *
 * `tools/singlefile.mjs` folds the whole app into one HTML file so it can be handed to somebody
 * without a server behind it. An `<img>` needs a real URL, so that build leaves a map of data URIs
 * on the window and this reads it. Nothing is set in a normal build, so the path is unchanged.
 */
declare global { interface Window { __TILES?: Record<string, string>; __SINGLE_FILE?: boolean } }

/** kind -> /tiles/<file>.png */
export function tileSrc(k: TileKind): string {
  const n = kindName(k).replace(':', '_');
  return window.__TILES?.[n] ?? asset(`tiles/${n}.png`);
}
export const TILE_BACK = asset('tiles/_back.png');
export const tileBack = (): string => window.__TILES?.['_back'] ?? TILE_BACK;
export function tileLabel(k: TileKind): string {
  const n = kindName(k);
  const m = /^([1-9])([wts])$/.exec(n);
  if (m) return `${m[1]}${({ w: '萬', t: '筒', s: '條' } as const)[m[2] as 'w' | 't' | 's']}`;
  return ({ E: '東', S: '南', W: '西', N: '北', R: '中', G: '發', Wh: '白' } as Record<string, string>)[n]
    ?? n.replace('A:', 'Animal: ').replace(/^F(\d)/, 'Flower $1').replace(/^S(\d)/, 'Season $1');
}
