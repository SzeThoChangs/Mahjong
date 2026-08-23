import { kindName, type TileKind } from 'sg-mahjong-engine';
/** kind -> /tiles/<file>.png */
export function tileSrc(k: TileKind): string {
  const n = kindName(k).replace(':', '_');
  return `/tiles/${n}.png`;
}
export const TILE_BACK = '/tiles/_back.png';
export function tileLabel(k: TileKind): string {
  const n = kindName(k);
  const m = /^([1-9])([wts])$/.exec(n);
  if (m) return `${m[1]} ${({ w: 'Wan', t: 'Tong', s: 'Sok' } as const)[m[2] as 'w' | 't' | 's']}`;
  return ({ E: '東', S: '南', W: '西', N: '北', R: 'Red Dragon', G: 'Green Dragon', Wh: 'White Dragon' } as Record<string, string>)[n]
    ?? n.replace('A:', 'Animal: ').replace(/^F(\d)/, 'Flower $1').replace(/^S(\d)/, 'Season $1');
}
