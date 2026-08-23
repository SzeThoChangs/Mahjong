import { describe, it, expect } from 'vitest';
import { baseChips, winPayments, meetsMinimum, immediatePayout, DEFAULT_TABLE } from '../src/payout.js';
import { loadTableConfig } from '../src/config.node.js';

describe('payout', () => {
  it('doubles per fan and caps at the limit', () => {
    expect([0,1,2,3,4,5,6].map(f => baseChips(f, 5))).toEqual([1,2,4,8,16,32,32]);
  });
  it('discarder pays double, others single', () => {
    expect(winPayments(2, 0, 2, DEFAULT_TABLE)).toEqual([0, 4, 8, 4]);
  });
  it('self-draw: everyone pays double; 13 wonders always self-draw', () => {
    expect(winPayments(2, 1, null, DEFAULT_TABLE)).toEqual([8, 0, 8, 8]);
    expect(winPayments(8, 1, 3, DEFAULT_TABLE, { thirteenWonders: true })).toEqual([64, 0, 64, 64]);
  });
  it('table minimum: 2 on discard, 1 on self-draw', () => {
    expect(meetsMinimum(1, false, DEFAULT_TABLE)).toBe(false);
    expect(meetsMinimum(1, true, DEFAULT_TABLE)).toBe(true);
    expect(meetsMinimum(2, false, DEFAULT_TABLE)).toBe(true);
  });
  it('immediate payouts double at MF2 and again from the initial hand', () => {
    expect(immediatePayout('kong_4', DEFAULT_TABLE)).toBe(8);
    expect(immediatePayout('kong_1', DEFAULT_TABLE, true)).toBe(8);
  });
  it('loads the table config from data/', () => {
    const c = loadTableConfig();
    expect(c.minimum_fan).toBe(2); expect(c.fan_limit).toBe(5); expect(c.self_draw_minimum_fan).toBe(1);
  });
});
