/**
 * The shard a question lives in is computed twice - once when the pack is built and once when the
 * app looks a stored card up - and the two must agree forever, because a mistake card in somebody's
 * browser stores only the pack and the question id. So the hash is pinned to values, not just to
 * properties: a change to it breaks this test before it breaks the Review tab.
 */
import { describe, it, expect } from 'vitest';
import { shardOf, shardFile } from '../src/pack.js';

describe('shard placement', () => {
  it('is pinned, because stored cards depend on it', () => {
    expect(shardOf('1913:14:38', 101)).toBe(71);
    expect(shardOf('521:13:43', 101)).toBe(33);
    expect(shardOf('248:19:43', 100)).toBe(58);
    expect(shardOf('', 7)).toBe(2);
  });
  it('stays inside the pack', () => {
    for (let g = 0; g < 500; g++) {
      const s = shardOf(`${g}:${g % 17}:${g % 41}`, 13);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(13);
    }
  });
  it('names shard files with three digits', () => {
    expect(shardFile(0)).toBe('000.json');
    expect(shardFile(57)).toBe('057.json');
    expect(shardFile(1000)).toBe('1000.json');
  });
});
