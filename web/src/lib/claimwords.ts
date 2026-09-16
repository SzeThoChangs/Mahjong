/**
 * The question a claim puts, in the words of the choices actually on offer.
 *
 * "Claim or pass?" named a category, and made the player work out which claims were even possible.
 * Changs asked on 2026-09-16 for the question to name them: "Pong or pass?", "Chow or pass?", and
 * all of them when there are several, "Pong, Chow or pass?". A win or a Kong on offer is named the
 * same way.
 *
 * Takes the compact action strings the packs and the engine use ("pass", "pong:22", "chow:3,4,5",
 * "kong3:7", "win") and returns text with game terms marked *like this*, for `jargon()` to render.
 * Several different Chows are one choice of Chow, named once.
 */
const ORDER: { key: string; word: string }[] = [
  { key: 'win', word: 'Win' },
  { key: 'kong3', word: '*Kong*' },
  { key: 'pong', word: '*Pong*' },
  { key: 'chow', word: '*Chow*' },
];

export function claimQuestion(actions: string[]): string {
  const kinds = new Set(actions.map((a) => a.split(':')[0]!));
  const named = ORDER.filter((o) => kinds.has(o.key)).map((o) => o.word);
  const all = kinds.has('pass') ? [...named, 'pass'] : named;
  if (!all.length) return 'Claim or pass?';
  if (all.length === 1) return `${all[0]}?`;
  return `${all.slice(0, -1).join(', ')} or ${all[all.length - 1]}?`;
}
