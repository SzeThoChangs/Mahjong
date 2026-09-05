/**
 * Self-play data generator.
 *   tsx src/generate.ts --hands 100000 --workers 8 --out ../data/gen/run1 --seed 1 [--truth] [--no-decisions] [--max-hands 32]
 */
import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_RANDOMNESS, type BotType } from './bots.js';
import { runWorker, type WorkerArgs } from './worker.js';
import { loadTableRulesOverride } from './tablerules.js';
import { makeRules } from 'sg-mahjong-engine';

function arg(name: string, def?: string): string | undefined { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? (process.argv[i + 1] ?? 'true') : def; }
const hands = Number(arg('hands', '1000'));
const workers = Number(arg('workers', String(Math.max(1, Math.min(8, cpus().length - 1)))));
const out = arg('out', '../data/gen/dev')!;
const baseSeed = Number(arg('seed', '1'));
const truth = process.argv.includes('--truth');
const decisions = !process.argv.includes('--no-decisions');
const maxHands = Number(arg('max-hands', '32'));
const randomness = arg('randomness') ? JSON.parse(arg('randomness')!) : DEFAULT_RANDOMNESS;
/** `--bots coach` seats the shipped coach in all four chairs instead of drawing personalities. */
const botTypes = arg('bots') ? (arg('bots')!.split(',').length === 4 ? arg('bots')!.split(',') : [0, 1, 2, 3].map(() => arg('bots')!)) as (BotType | 'pool')[] : undefined;
const rulesOverride = arg('rules') ? JSON.parse(arg('rules')!) : {};
const rules = makeRules({ ...(process.argv.includes('--book-rules') ? {} : loadTableRulesOverride()), ...rulesOverride });   // effective rules: table config + overrides (or --book-rules for engine defaults)

mkdirSync(out, { recursive: true });
const t0 = Date.now();
const quota = (i: number) => Math.floor(hands / workers) + (i < hands % workers ? 1 : 0);
type Shard = { worker: number; hands: number; sessions: number; decisions: number };
const manifest = { hands, workers, baseSeed, truth, decisions, maxHands, randomness, botTypes, rulesOverride, rules, conventions: { winds_rotate_with_dealer: true, engine_semantics: 2 }, startedAt: new Date().toISOString(), shards: [] as Shard[] };

if (workers <= 1) {
  const res = runWorker({ workerIndex: 0, workers: 1, handQuota: hands, out, baseSeed, truth, rulesOverride, rules, randomness, maxHands, decisions, botTypes }, (n) => { if (n % 1000 === 0) process.stdout.write(`\r${n}/${hands} hands`); });
  manifest.shards.push({ worker: 0, ...res });
  finish();
} else {
  const progress = new Array<number>(workers).fill(0);
  let remaining = workers;
  for (let i = 0; i < workers; i++) {
    const args: WorkerArgs = { workerIndex: i, workers, handQuota: quota(i), out, baseSeed, truth, rulesOverride, rules, randomness, maxHands, decisions, botTypes };
    const w = new Worker(fileURLToPath(new URL('./worker.ts', import.meta.url)), { workerData: args });
    w.on('message', (m: { type: string; hands: number; sessions?: number; decisions?: number }) => {
      if (m.type === 'progress') { progress[i] = m.hands; const tot = progress.reduce((a, b) => a + b, 0); if (tot % 500 < 40) { const line = `${tot}/${hands} hands  ${(tot / ((Date.now() - t0) / 1000)).toFixed(0)} hands/s`; if (process.stdout.isTTY) process.stdout.write(`\r${line}   `); else if (tot % 5000 < 40) console.log(line); } }
      if (m.type === 'done') { manifest.shards.push({ worker: i, hands: m.hands, sessions: m.sessions ?? 0, decisions: m.decisions ?? 0 }); if (--remaining === 0) finish(); }
    });
    w.on('error', (e) => { console.error(`worker ${i} failed:`, e); process.exit(1); });
  }
}
function finish() {
  const secs = (Date.now() - t0) / 1000;
  const totalHands = manifest.shards.reduce((a, s) => a + s.hands, 0);
  const totalDecisions = manifest.shards.reduce((a, s) => a + s.decisions, 0);
  writeFileSync(join(out, 'manifest.json'), JSON.stringify({ ...manifest, finishedAt: new Date().toISOString(), seconds: secs, totalHands, totalDecisions }, null, 2));
  console.log(`\n${totalHands} hands, ${totalDecisions} decisions in ${secs.toFixed(1)}s (${(totalHands / secs).toFixed(0)} hands/s) -> ${out}`);
}
