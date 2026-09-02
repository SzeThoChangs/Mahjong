/**
 * Do the book's shape tips pick the tile the play-outs say is best?
 *
 *   tsx src/tiptest.ts --quiz ../web/public/quiz --pack money
 *
 * `shapes.ts` checks the tips by counting, which settles what a shape ACCEPTS and nothing else. This
 * asks the harder question. Every position in a quiz pack has been played out 128 times per option,
 * so each one already carries a measured best. `shapetag.ts` says which positions a tip is about,
 * and which throws follow it. Put the two together and a tip becomes a claim that can be scored.
 *
 * THE BASELINE IS THE WHOLE MEASUREMENT. A tip that points at three of fourteen tiles will look
 * right a fifth of the time by luck, and a tip pointing at the loose tiles will look right far more
 * often than that, because loose tiles are what a hand throws anyway. So a raw hit rate says
 * nothing. Two corrections here:
 *
 *  - Only positions the tip RESOLVES are counted: the measured best is either a throw it points at
 *    or one it warns against. If the best is a third tile the tip had no opinion and neither do we.
 *  - Against a coin whose bias is the tip's own share of the choice. With 3 tiles pointed at and 2
 *    warned against, following it at random is 60%, and beating 60% is the only thing that counts.
 *
 * WHAT IT CANNOT SEPARATE. A measured best is the best throw in the whole position, so it prices
 * danger as well as shape. A tip that says break your third pair is being judged against a play-out
 * that may prefer the lone honour because it is safe. So a tip failing here has failed as ADVICE at
 * this table, which is what the app teaches, and not necessarily as a claim about shape.
 *
 * A pack is also not a random sample of the game: its positions are the ones where one throw
 * separates from the rest by more than two standard errors. The numbers are about decisions with a
 * clear answer, which is the population the app quizzes on.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { liveCalls } from 'sg-mahjong-solver';

function arg(n: string, d?: string) { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? (process.argv[i + 1] ?? d) : d; }
const quizDir = arg('quiz', '../web/public/quiz')!;
const only = arg('pack');

interface PackQ { k: string; h: number[]; m: number[][]; actions: { a: string }[]; best: string }
interface Score { seen: number; resolved: number; follows: number; expected: number; variance: number }

const files = readdirSync(quizDir)
  .filter((f) => f.endsWith('.json') && f !== 'index.json' && (!only || f === `${only}.json`));

for (const f of files) {
  const pack = JSON.parse(readFileSync(join(quizDir, f), 'utf8')) as { questions: PackQ[] };
  const st = new Map<string, Score>();
  let discards = 0, tagged = 0;
  for (const q of pack.questions) {
    if (q.k !== 'discard' || !q.best.startsWith('d:')) continue;
    discards++;
    const throws = q.actions.filter((a) => a.a.startsWith('d:')).map((a) => Number(a.a.slice(2)));
    const best = Number(q.best.slice(2));
    const calls = liveCalls(q.h, q.m.length, throws);
    if (calls.length) tagged++;
    for (const c of calls) {
      const says = c.says.filter((k) => throws.includes(k)), against = c.against.filter((k) => throws.includes(k));
      const s = st.get(c.tip) ?? { seen: 0, resolved: 0, follows: 0, expected: 0, variance: 0 };
      s.seen++;
      const hit = says.includes(best), miss = against.includes(best);
      if (hit || miss) {
        // the coin this position would flip if the throw were picked at random from the two sides
        const p = says.length / (says.length + against.length);
        s.resolved++; s.follows += hit ? 1 : 0; s.expected += p; s.variance += p * (1 - p);
      }
      st.set(c.tip, s);
    }
  }
  console.log(`\n${f}: ${tagged} of ${discards} discard positions are about a tip`);
  console.log('  tip                    about  resolved   follows it   by luck    z');
  for (const [t, s] of [...st].sort((a, b) => b[1].seen - a[1].seen)) {
    const rate = s.follows / s.resolved, luck = s.expected / s.resolved;
    const z = s.variance > 0 ? (s.follows - s.expected) / Math.sqrt(s.variance) : 0;
    console.log(`  ${t.padEnd(22)} ${String(s.seen).padStart(5)}  ${String(s.resolved).padStart(8)}   ${`${(100 * rate).toFixed(0)}%`.padStart(10)}  ${`${(100 * luck).toFixed(0)}%`.padStart(8)}  ${z >= 0 ? '+' : ''}${z.toFixed(1)}`);
  }
}
