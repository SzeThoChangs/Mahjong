/**
 * Why a mistake happened, which is the only thing that says what to practise.
 *
 * The method's eighth idea: sort every mistake by its cause, then point practice at whichever
 * cause keeps coming up, because more puzzles do not fix a problem that is really about safety. The
 * chess list had eight causes. This is the mahjong list, with one added - playing for the wrong
 * plan - because at this table the plan is half the game, and one dropped, the clock, because the
 * app has none.
 *
 * Half of the sorting can be done without asking. The coach's own ranking knows whether the tile
 * you threw cost the hand a step, whether it was more dangerous, whether it was playing for a
 * different plan, and the shape tips know when a card on the Tips page names the coach's tile and
 * warns against yours. That is a SUGGESTION. The other half is one question at the moment of the
 * mistake, because only you know whether you saw the pattern and threw the other tile anyway.
 */
import { shanten, type TileKind, type Meld } from 'sg-mahjong-engine';
import { liveCalls, type TableView } from './shapetag.js';
import { TIPS } from './tips.js';
import type { DiscardOption } from './rank.js';

export type Cause =
  | 'never-learnt' | 'not-seen' | 'not-considered' | 'miscounted'
  | 'misjudged-safety' | 'wrong-plan' | 'missed-tile' | 'knew-anyway';

/** the causes in the order the question shows them, each said the way a person would say it */
export const CAUSES: { id: Cause; label: string; blurb: string }[] = [
  { id: 'never-learnt', label: 'Never learnt it', blurb: 'The idea behind the right tile is new to me.' },
  { id: 'not-seen', label: 'Did not see it', blurb: 'I know the idea; I did not spot it in this hand.' },
  { id: 'not-considered', label: 'Never considered that tile', blurb: 'I saw the situation but that throw was not on my list.' },
  { id: 'miscounted', label: 'Miscounted', blurb: 'I considered it and got the tiles or the distance wrong.' },
  { id: 'misjudged-safety', label: 'Misjudged the safety', blurb: 'The counting was fine; I misread how dangerous my tile was.' },
  { id: 'wrong-plan', label: 'Played for the wrong plan', blurb: 'I was building a different hand from the one worth building.' },
  { id: 'missed-tile', label: 'Missed a tile on the table', blurb: 'Something in the Discard Pool or the Melds I simply did not take in.' },
  { id: 'knew-anyway', label: 'Knew, and threw something else', blurb: 'I found the right tile and did not play it.' },
];
export const causeLabel = (c: Cause): string => CAUSES.find((x) => x.id === c)?.label ?? c;

export interface CauseSuggestion {
  /** the cause the evidence points at, or null when the evidence says nothing either way */
  suggested: Cause | null;
  /** one sentence saying what the evidence was, for the question to show beside the suggestion */
  because: string;
  /** the tip the throw broke, when that is what the evidence is */
  tip?: string;
}

/**
 * Read the cause off the position, as far as it can be read.
 *
 * In order: a shape tip that names the coach's tile and warns against yours; a throw that cost
 * the hand a step when the coach's did not; a throw playing for a different plan; a throw that was
 * plainly more dangerous. Anything else is a question for the player.
 */
export function suggestCause(hand: TileKind[], melds: Meld[], view: TableView, options: DiscardOption[], picked: TileKind, best: TileKind): CauseSuggestion {
  const p = options.find((o) => o.tile === picked), b = options.find((o) => o.tile === best);
  if (!p || !b || picked === best) return { suggested: null, because: '' };

  const throws = options.map((o) => o.tile);
  for (const c of liveCalls(hand, melds.length, throws, view)) {
    if (c.says.includes(best) && c.against.includes(picked)) {
      const t = TIPS.find((x) => x.id === c.tip);
      return { suggested: 'not-seen', tip: c.tip, because: `A card on the Tips page is about exactly this: ${t?.title ?? c.tip}.` };
    }
  }

  const without = (k: TileKind) => { const r = [...hand]; const i = r.indexOf(k); if (i >= 0) r.splice(i, 1); return r; };
  const shP = shanten(without(picked), melds.length), shB = shanten(without(best), melds.length);
  if (shP > shB) return { suggested: 'miscounted', because: 'Your tile left the hand a step further from ready than the coach’s did.' };

  if (p.target.id !== b.target.id) return { suggested: 'wrong-plan', because: `Your tile was building ${planName(p.target.id)}; the coach’s was building ${planName(b.target.id)}.` };

  if (p.risk > b.risk + 0.2) return { suggested: 'misjudged-safety', because: 'Same plan, same distance - your tile was the more dangerous one to throw.' };

  return { suggested: null, because: 'The coach’s ranking does not separate the two on shape, distance, plan or danger, so only you can say.' };
}

const planName = (id: string): string =>
  id === 'half_color' ? 'a half-colour hand' : id === 'ping_wu' ? 'ping wu' : id === 'all_chow' ? 'an all-chow hand'
  : id === 'all_pong' ? 'all pongs' : id === 'chicken' ? 'the cheap hand' : id === 'thirteen' ? 'thirteen wonders' : id;
