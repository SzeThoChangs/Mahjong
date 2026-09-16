#!/usr/bin/env node
/* check-screens.js — open every screen the links reach, in a real browser, and
   read what it says. Part of the ten passes (P-Starter Part 9). Only for a
   project with a UI.

   On each screen it reports:
     THROWS    a page error, or a failed navigation
     CONSOLE   an error written to the browser console
     REQUEST   a request that failed, or came back 400 or above
     BROKEN    NaN, [object Object], undefined or null printed as text
     DASH      a key figure that is only a dash or empty — set STAT_SELECTOR
     DEFAULT   a form <select> that opens on a real value nobody chose
     OVERFLOW  sideways scroll at 280px or 1280px

   A hit fails the run until it is fixed, or read and added to
   check-screens-known.json with the reason it stands and the date the reason
   was written. An entry without both is ignored, so the hit fails again.
   THROWS can never be marked known.

   Setup:  npm i -D playwright
           npx playwright install chromium
   Run:    start the application, then
           BASE_URL=http://localhost:3000/ node check-screens.js
           ... --list      print every hit, known or not

   STAT_SELECTOR   the CSS for the project's key figures. Without it, DASH finds
                   nothing, and a blank figure goes unreported.
   STORAGE_STATE   a Playwright storage state file for a signed-in account. The
                   crawler only reaches what its account can reach: run it once
                   per access level that matters.
   MAX_PAGES       stop after this many screens, default 500.

   Before trusting it, prove it can fail: on a copy, put back a known fault,
   run it, confirm it is caught, restore, run again. */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000/';
const MAX = Number(process.env.MAX_PAGES || 500);
const STAT_SELECTOR = process.env.STAT_SELECTOR || '[data-stat]';
const KNOWN_FILE = path.join(__dirname, 'check-screens-known.json');

/* One entry per page kind, not per record: /invoice/INV-123 becomes /invoice/*. */
const shape = u => u.replace(BASE, '/').replace(/\/[^/?#]*\d[^/?#]*/g, '/*').replace(/\?.*$/, '');

/* A known entry counts only if someone wrote down why, and when. */
const validKnown = v => v && typeof v === 'object' && String(v.reason || '').trim()
  && /^\d{4}-\d{2}-\d{2}$/.test(String(v.date || ''));

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 800 } },
    process.env.STORAGE_STATE ? { storageState: process.env.STORAGE_STATE } : {}));
  const page = await context.newPage();
  let events = [];
  page.on('pageerror', e => events.push(['THROWS', e.message]));
  page.on('console', m => { if (m.type() === 'error') events.push(['CONSOLE', m.text()]); });
  page.on('requestfailed', r => events.push(['REQUEST', r.method() + ' ' + r.url() + ' ' + ((r.failure() || {}).errorText || '')]));
  page.on('response', r => { if (r.status() >= 400) events.push(['REQUEST', r.status() + ' ' + r.url()]); });

  const seen = new Set([BASE]), queue = [BASE], hits = [];
  const add = (kind, url, key) => hits.push({ kind, url, key: `${kind} | ${shape(url)} | ${String(key).slice(0, 100)}` });

  while (queue.length && seen.size <= MAX) {
    const url = queue.shift();
    events = [];
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: 'networkidle' }).catch(e => events.push(['THROWS', 'navigation: ' + e.message]));
    await page.waitForTimeout(150);

    const r = await page.evaluate(sel => {
      document.querySelectorAll('details').forEach(d => d.open = true);
      const text = document.body ? document.body.innerText : '';
      const broken = [...text.matchAll(/.{0,30}(\bNaN\b|\[object Object\]|\bundefined\b|\bnull\b).{0,20}/g)].map(m => m[0].trim());
      const dashes = [...document.querySelectorAll(sel)].filter(e => /^[—–-]?$/.test(e.innerText.trim()))
        .map(e => ((e.parentElement && e.parentElement.innerText) || '').trim().slice(0, 40));
      const defaults = [...document.querySelectorAll('form select:not([multiple])')].map(s => {
        const o = [...s.options];
        if (!o.length || o.some(x => x.defaultSelected) || o[0].value === '') return null;
        return (s.name || s.id || '(unnamed)') + ' = ' + o[0].text.trim();
      }).filter(Boolean);
      const links = [...document.querySelectorAll('a[href]')].map(a => a.href);
      const wide = document.documentElement.scrollWidth > innerWidth + 1;
      return { broken, dashes, defaults, links, wide };
    }, STAT_SELECTOR).catch(e => { events.push(['THROWS', 'read: ' + e.message]); return { broken: [], dashes: [], defaults: [], links: [], wide: false }; });

    events.forEach(([k, m]) => add(k, url, m));
    r.broken.forEach(b => add('BROKEN', url, b));
    r.dashes.forEach(d => add('DASH', url, d));
    r.defaults.forEach(d => add('DEFAULT', url, d));
    if (r.wide) add('OVERFLOW', url, '1280px');

    await page.setViewportSize({ width: 280, height: 800 });
    await page.waitForTimeout(100);
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1).catch(() => false))
      add('OVERFLOW', url, '280px');

    for (const l of r.links) {
      const clean = l.replace(/#$/, '');
      if (!clean.startsWith(BASE) || seen.has(clean)) continue;
      seen.add(clean); queue.push(clean);
    }
  }
  await browser.close();

  let known = {};
  try { known = JSON.parse(fs.readFileSync(KNOWN_FILE, 'utf8')); } catch (e) {}
  const list = process.argv.includes('--list');
  const keys = [...new Set(hits.map(h => h.key))].sort();
  const isKnown = k => !k.startsWith('THROWS') && validKnown(known[k]);
  const fresh = keys.filter(k => !isKnown(k));
  const badKnown = Object.keys(known).filter(k => !validKnown(known[k]));
  (list ? keys : fresh).forEach(k => console.log((isKnown(k) ? 'known ' : 'NEW   ') + k +
    (isKnown(k) ? '  — ' + known[k].reason + ' (' + known[k].date + ')' : '')));
  badKnown.forEach(k => console.log('IGNORED known entry without a reason and a date: ' + k));
  console.log(`${seen.size} screens, ${fresh.length} unread hits, ${keys.length - fresh.length} read and kept`);
  process.exit(fresh.length ? 1 : 0);
})();
