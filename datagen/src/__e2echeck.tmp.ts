/** End-to-end: pair a stored (pre-e036df2) eval with the decision quizpack would now attach to it. */
import { readFileSync, createReadStream } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync, createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { rulesForDir } from './tablerules.js';
import { decisionsOfHand, type EvalRecord } from './evaluate.js';
import { DEFAULT_RANDOMNESS } from './bots.js';
import type { HandRecord, DecisionRecord } from './records.js';

const dir = '../data/gen/run100k-table';

function* jsonlGz<T>(path: string): Generator<T> {
  const txt = gunzipSync(readFileSync(path)).toString('utf8');
  for (const line of txt.split('\n')) if (line) yield JSON.parse(line) as T;
}

const hands = new Map<string, HandRecord>();
for (const h of jsonlGz<HandRecord>(join(dir, 'hands-w0.jsonl.gz'))) hands.set(`${h.g}:${h.h}`, h);

const rules = rulesForDir(dir);
const cands: { e: EvalRecord; hr: HandRecord }[] = [];
for (const e of jsonlGz<EvalRecord>(join(dir, 'evals-w0.jsonl.gz'))) {
  const hr = hands.get(`${e.g}:${e.h}`);
  if (hr && hr.dl !== 0) { cands.push({ e, hr }); if (cands.length >= 200) break; }
}
console.log('candidate evals on dealer!=0 hands (shard 0):', cands.length);

const want = new Set(cands.map((c) => `${c.e.g}:${c.e.h}:${c.e.d}`));
const orig = new Map<string, DecisionRecord>();
const rl = createInterface({ input: createReadStream(join(dir, 'decisions-w0.jsonl.gz')).pipe(createGunzip()), crlfDelay: Infinity });
for await (const line of rl) {
  if (!line) continue;
  // cheap prefilter before JSON.parse
  const m = /^\{"g":(\d+),"h":(\d+),"d":(\d+),/.exec(line);
  if (!m || !want.has(`${m[1]}:${m[2]}:${m[3]}`)) continue;
  const d = JSON.parse(line) as DecisionRecord;
  orig.set(`${d.g}:${d.h}:${d.d}`, d);
  if (orig.size === want.size) break;
}
rl.close();
console.log('original decisions found:', orig.size);

let same = 0, diff = 0, shown = 0;
const replayCache = new Map<string, DecisionRecord[]>();
for (const { e, hr } of cands) {
  const key = `${e.g}:${e.h}`;
  let decs = replayCache.get(key);
  if (!decs) { decs = decisionsOfHand(hr, rules, DEFAULT_RANDOMNESS); replayCache.set(key, decs); }
  const now = decs.find((x) => x.d === e.d);                       // exactly quizpack's pairing
  const old = orig.get(`${e.g}:${e.h}:${e.d}`);
  if (!old) continue;
  const oldH = [...old.me.h].sort((a, b) => a - b).join(',');
  const newH = now ? [...now.me.h].sort((a, b) => a - b).join(',') : '(none)';
  const match = now && oldH === newH && old.sel === now.sel && old.p === now.p && old.k === now.k;
  if (match) same++; else {
    diff++;
    if (shown < 3) {
      shown++;
      console.log(`\nCORRUPTED PAIRING ${e.g}:${e.h}:${e.d} (dl=${hr.dl})  evalSel=${e.sel} evalBest=${e.best} evalSeat=${e.seat} bestEv=${e.actions[0]!.ev.toFixed(2)}`);
      console.log('  EVs were measured on : k=%s seat=%s sel=%s hand=[%s]', old.k, old.p, old.sel, oldH);
      console.log('  quizpack now shows   : k=%s seat=%s sel=%s hand=[%s]', now?.k, now?.p, now?.sel, newH);
    }
  }
}
console.log(`\npairings identical: ${same}, corrupted: ${diff} (of ${same + diff} checked)`);
