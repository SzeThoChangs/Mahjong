import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { DEFAULT_TABLE, type TableConfig } from './payout.js';

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
