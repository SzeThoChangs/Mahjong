import { shanten } from 'sg-mahjong-engine';
const NAME = (k: number) => k < 9 ? `${k+1}萬` : k < 18 ? `${k-8}筒` : k < 27 ? `${k-17}條` : (['東','南','西','北','中','發','白'][k-27] ?? '?');
/** which draws reduce shanten for this 13-tile hand? */
function accepts(hand: number[], melds = 0) {
  const base = shanten(hand, melds);
  const out: string[] = [];
  for (let k = 0; k < 34; k++) {
    if (hand.filter((x) => x === k).length >= 4) continue;
    if (shanten([...hand, k], melds) < base) out.push(NAME(k));
  }
  return { base, out };
}
// 1萬1萬 eyes · 2萬4萬 · 5筒7筒9筒 · 1條2條 · 白白 · 3萬 filler = 13
const hand = [0,0,1,3,2, 13,15,17, 18,19, 33,33, 4];
const r = accepts(hand);
console.log('hand:', hand.map(NAME).join(' '));
console.log(`shanten ${r.base}, accepts ${r.out.length} kinds: ${r.out.join(' ')}`);
console.log('  6筒 in the list?', r.out.includes('6筒'), '   8筒 in the list?', r.out.includes('8筒'));
// and the isolated shape, to be sure it is the shape and not the rest of the hand
const bare = accepts([13,15,17, 0,0, 1,2,3, 18,19,20, 22,23]);
console.log(`\nisolated 5/7/9筒 in an otherwise settled hand: accepts ${bare.out.join(' ')}`);
