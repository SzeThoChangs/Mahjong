/** Plays a session of hands (dealer rotation, prevailing wind, running scores) with recording. */
import { Wall, makeRng, playGame, tableConfigOf, type RulesConfig, type Decision } from 'sg-mahjong-engine';
import { makeBot, type BotType, type RandomnessConfig, DEFAULT_RANDOMNESS } from './bots.js';
import { encodeDecision, fnv1a, type DecisionRecord, type HandRecord, type TruthRecord } from './records.js';

export interface SessionSink {
  decision(r: DecisionRecord): void;
  hand(r: HandRecord): void;
  truth?(r: TruthRecord): void;
}
export interface SessionOptions {
  sessionId: number; seed: number; rules: RulesConfig; botTypes: BotType[];
  randomness?: RandomnessConfig; maxHands?: number; sink?: SessionSink; recordDecisions?: boolean;
}

/** Deterministic per-hand seed from session seed and hand index. */
export const handSeed = (sessionSeed: number, handIdx: number) => (fnv1a(`${sessionSeed}:${handIdx}`) || 1);
/** Deterministic bot rng seed per hand and seat. */
export const botSeed = (hSeed: number, seat: number) => (fnv1a(`${hSeed}:bot:${seat}`) || 1);

export interface HandSetup { sessionId: number; handIdx: number; seed: number; dealer: number; prevailingWind: number; botTypes: BotType[]; scores: number[] }

/** Play one hand from a full setup. Used by the session loop and by replay. */
export function playHand(setup: HandSetup, rules: RulesConfig, randomness: RandomnessConfig, sink?: SessionSink, recordDecisions = true) {
  const cfg = tableConfigOf(rules);
  const wall = new Wall(makeRng(setup.seed), rules.unplayable_tiles);
  const wallOrder = wall.snapshot().order;
  const bots = setup.botTypes.map((t, seat) => makeBot(t, makeRng(botSeed(setup.seed, seat)), randomness));
  let decisionIdx = 0; let hash = 0x811c9dc5;
  const acts: Record<string, Record<string, number>> = {};
  const recorder = {
    record: (d: Decision) => {
      const bot = setup.botTypes[d.seat]!;
      hash = fnv1a(`${d.kind}:${d.seat}:${JSON.stringify(d.selected)}`, hash);
      (acts[bot] ??= {})[d.selected.a] = ((acts[bot] ??= {})[d.selected.a] ?? 0) + 1;
      if (sink && recordDecisions) sink.decision(encodeDecision(d, { g: setup.sessionId, h: setup.handIdx, d: decisionIdx, seed: setup.seed, sc: setup.scores, bot }));
      decisionIdx++;
    },
  };
  const r = playGame(bots, cfg, wall, { dealer: setup.dealer, prevailingWind: setup.prevailingWind, rules, recorder });
  const scoresAfter = setup.scores.map((s, i) => s + r.chipsDelta[i]!);
  const rec: HandRecord = {
    g: setup.sessionId, h: setup.handIdx, seed: setup.seed, dl: setup.dealer, w: setup.prevailingWind, bots: setup.botTypes,
    winner: r.winner, sd: r.selfDraw, disc: r.discarder, fan: r.score?.fan ?? null, combo: r.score?.combination ?? null,
    turns: r.playerTurns, cnt: r.counts, delta: r.chipsDelta, scores: scoresAfter, acts, hash: (hash >>> 0).toString(16),
  };
  sink?.hand(rec);
  sink?.truth?.({ g: setup.sessionId, h: setup.handIdx, seed: setup.seed, dl: setup.dealer, w: setup.prevailingWind, wall: wallOrder });
  return { result: r, record: rec };
}

export function runSession(o: SessionOptions): { hands: HandRecord[]; scores: number[] } {
  const randomness = o.randomness ?? DEFAULT_RANDOMNESS;
  const maxHands = o.maxHands ?? 32;
  const dr = o.rules.dealer_rules;
  let dealer = 0, prevailingWind = 0, dealerSeatsThisWind = 1;
  let scores = [0, 0, 0, 0];
  const hands: HandRecord[] = [];
  for (let h = 0; h < maxHands; h++) {
    const seed = handSeed(o.seed, h);
    const { result, record } = playHand({ sessionId: o.sessionId, handIdx: h, seed, dealer, prevailingWind, botTypes: o.botTypes, scores }, o.rules, randomness, o.sink, o.recordDecisions ?? true);
    hands.push(record); scores = record.scores;
    const retain = (result.winner === dealer && dr.retain_on_win) || (result.winner === null && dr.retain_on_draw);
    if (!retain) {
      dealer = (dealer + 1) % 4; dealerSeatsThisWind++;
      if (dealerSeatsThisWind > dr.hands_per_wind) { prevailingWind++; dealerSeatsThisWind = 1; }
      if (prevailingWind >= 4) break;          // four winds played: session over
    }
  }
  return { hands, scores };
}
