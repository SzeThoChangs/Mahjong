/**
 * Jargon, marked once and rendered everywhere.
 *
 * The app's own words for the game are written `*like this*` in card text and UI strings, and this
 * renders them in italics, coloured by what kind of word they are. Two reasons for marking rather
 * than styling in place. The terms are spread across tips cards, drill prompts and explanations, and
 * a term that is styled on one screen and plain on the next reads as two different words. And the
 * set of terms is still being agreed, so it has to be cheap to add one: write the asterisks, and
 * every screen that renders text through here picks it up.
 *
 * The colour says which kind of word it is, which is the thing a learner cannot get from the word
 * itself. A *Chow* is something you do, a *Dragon* is something you hold, and *Pong Pong* is a hand
 * you are trying to make - three different sorts of fact wearing the same kind of name. The Tips
 * page carries the key.
 *
 * Deliberately not markdown. It handles exactly one thing, so a stray asterisk in a hand notation
 * cannot turn half a sentence into emphasis.
 */
import { Fragment, type ReactNode } from 'react';

/** The six kinds of term, from JARGON.md. `ours` is the project's own vocabulary, not the game's. */
export type JargonKind = 'action' | 'hand' | 'tile' | 'shape' | 'table' | 'ours';

/**
 * Every term, by kind. Keys are lower case and singular; `kindOf` handles plurals and possessives.
 *
 * A term missing from here still renders in italics, just without a colour, so adding a word to a
 * card cannot break a page - it only means the word has not been sorted yet.
 */
const KIND: Record<string, JargonKind> = {
  // what you do
  chow: 'action', pong: 'action', kong: 'action', 'zi mo': 'action', 'deal-in': 'action', bao: 'action',
  // what you are trying to make
  'half colour': 'hand', 'full colour': 'hand', 'ping wu': 'hand', 'pong pong': 'hand', 'pi wu': 'hand',
  // what you hold
  terminal: 'tile', honour: 'tile', simple: 'tile', 'middle tile': 'tile', dragon: 'tile',
  'seat wind': 'tile', 'prevailing wind': 'tile', flower: 'tile', animal: 'tile', 'bonus tile': 'tile',
  joker: 'tile',
  // the parts a hand is made of
  block: 'shape', wait: 'shape', floater: 'shape', meld: 'shape', 'ting pai': 'shape',
  // the table, its clock and its money
  tai: 'table', turn: 'table', wall: 'table', 'discard pool': 'table',
  // ours, not the game's
  'measured best': 'ours', coach: 'ours', field: 'ours', cause: 'ours', trap: 'ours',
  decisive: 'ours', shanten: 'ours',
};

/**
 * Colour per kind, light and dark.
 *
 * Deep enough to read as text rather than as a highlight, and far enough apart that two kinds in one
 * sentence are tellable. `ours` is deliberately the quietest: those words are ours rather than the
 * game's, and they should not shout louder than the mahjong.
 */
const TONE: Record<JargonKind, string> = {
  action: 'text-sky-700 dark:text-sky-300',
  hand: 'text-violet-700 dark:text-violet-300',
  tile: 'text-emerald-700 dark:text-emerald-400',
  shape: 'text-amber-700 dark:text-amber-400',
  table: 'text-rose-700 dark:text-rose-300',
  ours: 'text-slate-600 dark:text-slate-300',
};

/** What the terms are called on the key, in the order the key shows them. */
export const KIND_LABEL: { kind: JargonKind; label: string; example: string }[] = [
  { kind: 'action', label: 'what you do', example: 'Pong' },
  { kind: 'tile', label: 'what you hold', example: 'Dragon' },
  { kind: 'shape', label: 'parts of a hand', example: 'Block' },
  { kind: 'hand', label: 'hands you can make', example: 'Pong Pong' },
  { kind: 'table', label: 'the table and its clock', example: 'Tai' },
  { kind: 'ours', label: "this app's own words", example: 'Measured Best' },
];

/** Look a term up, allowing for a plural or a possessive: Kongs, Coaches, the Coach's. */
export function kindOf(term: string): JargonKind | null {
  const t = term.toLowerCase().replace(/[’']s$/, '');
  return KIND[t] ?? KIND[t.replace(/es$/, '')] ?? KIND[t.replace(/s$/, '')] ?? null;
}

/** Split on `*term*` and mark the terms. Anything else is returned unchanged. */
export function jargon(text: string): ReactNode {
  if (!text.includes('*')) return text;
  const parts = text.split(/\*([^*]+)\*/g);
  return parts.map((p, i) => (i % 2 === 1 ? <J key={i}>{p}</J> : <Fragment key={i}>{p}</Fragment>));
}

/**
 * The same mark, for text written as JSX rather than as a string.
 *
 * The page copy outside the cards is written straight into the markup, often around a `<b>` or an
 * interpolated number, so there is no string for `jargon` to split. Wrapping the term in `<J>` keeps
 * one definition of what a marked term looks like. Pass `kind` where the children are not a plain
 * word this can look up.
 */
export function J({ children, kind }: { children: ReactNode; kind?: JargonKind }) {
  const k = kind ?? (typeof children === 'string' ? kindOf(children) : null);
  return <em className={k ? `italic ${TONE[k]}` : 'italic'}>{children}</em>;
}

/** The colour on its own, for a key or a legend that is not itself a marked term. */
export const toneOf = (kind: JargonKind): string => TONE[kind];
