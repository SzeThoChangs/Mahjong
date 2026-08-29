import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { DEFAULT_TABLE, type TableConfig } from './payout.js';
import { makeRules, type RulesConfig } from './rules.js';

/** Load ../data/table.config.json relative to the engine package. Falls back to defaults. */
export function loadTableConfig(path?: string): TableConfig {
  const here = dirname(fileURLToPath(import.meta.url));
  const p = path ?? resolve(here, '../../data/table.config.json');
  try {
    const raw = JSON.parse(readFileSync(p, 'utf8')) as Partial<TableConfig> & { unplayable_tiles?: number };
    return {
      minimum_fan: raw.minimum_fan ?? DEFAULT_TABLE.minimum_fan,
      fan_limit: raw.fan_limit ?? DEFAULT_TABLE.fan_limit,
      self_draw_minimum_fan: raw.self_draw_minimum_fan ?? DEFAULT_TABLE.self_draw_minimum_fan,
      immediate_payouts_multiplier: raw.immediate_payouts_multiplier ?? DEFAULT_TABLE.immediate_payouts_multiplier,
      unplayable_tiles: raw.unplayable_tiles ?? DEFAULT_TABLE.unplayable_tiles,
    };
  } catch {
    return { ...DEFAULT_TABLE };
  }
}

/**
 * The table's full house rules, not just its fan limits: the `rules` block of table.config.json
 * deep-merged over the engine defaults. Anything that DEALS a wall needs this - `jokers.count`
 * lives here, and a wall built without it plays a different game from the recorded dataset.
 */
export function loadTableRules(path?: string): RulesConfig {
  const here = dirname(fileURLToPath(import.meta.url));
  const p = path ?? resolve(here, '../../data/table.config.json');
  try {
    const raw = JSON.parse(readFileSync(p, 'utf8')) as {
      minimum_fan?: number; fan_limit?: number; self_draw_minimum_fan?: number; rules?: Record<string, unknown>;
    };
    const o: Record<string, unknown> = { ...(raw.rules ?? {}) };
    if (raw.minimum_fan !== undefined) o.minimum_tai = raw.minimum_fan;
    if (raw.fan_limit !== undefined) o.maximum_tai = raw.fan_limit;
    if (raw.self_draw_minimum_fan !== undefined) o.self_draw_minimum_tai = raw.self_draw_minimum_fan;
    delete o._note;
    return makeRules(o);
  } catch { return makeRules(); }
}
