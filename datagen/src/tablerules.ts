/** The table's house rules from data/table.config.json (the `rules` block), as a deep-partial override for makeRules. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export function loadTableRulesOverride(path?: string): Record<string, unknown> {
  const here = dirname(fileURLToPath(import.meta.url));
  const p = path ?? resolve(here, '../../data/table.config.json');
  try {
    const raw = JSON.parse(readFileSync(p, 'utf8')) as { minimum_fan?: number; fan_limit?: number; self_draw_minimum_fan?: number; rules?: Record<string, unknown> };
    const o: Record<string, unknown> = { ...(raw.rules ?? {}) };
    if (raw.minimum_fan !== undefined) o.minimum_tai = raw.minimum_fan;
    if (raw.fan_limit !== undefined) o.maximum_tai = raw.fan_limit;
    if (raw.self_draw_minimum_fan !== undefined) o.self_draw_minimum_tai = raw.self_draw_minimum_fan;
    delete o._note;
    return o;
  } catch { return {}; }
}

import { makeRules, type RulesConfig } from 'sg-mahjong-engine';
/** Rules a dataset directory was generated with (manifest.rules), else legacy: engine defaults + manifest.rulesOverride. */
export function rulesForDir(dir: string, override: object = {}): RulesConfig {
  try {
    const m = JSON.parse(readFileSync(resolve(dir, 'manifest.json'), 'utf8')) as { rules?: RulesConfig; rulesOverride?: object };
    if (m.rules) return makeRules({ ...(m.rules as object), ...override });
    return makeRules({ ...(m.rulesOverride ?? {}), ...override });
  } catch { return makeRules(override); }
}
