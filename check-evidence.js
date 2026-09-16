#!/usr/bin/env node
/* check-evidence.js — fail any claim that something was checked, unless the same
   paragraph says when or how. Part of the ten passes (P-Starter Part 9).

   In the files that say what is true now, a block claiming a check (verified,
   tested, every step, works, renders, fits, no errors, passes) must carry its
   evidence in the same block:
     a time it was measured (08:37), "Evidence:", "measured", "tried", "clicked",
     a check script's name, or an honest "not checked", "not run", "not tried".

     UNBACKED  a claim with no evidence beside it
     STALE     in a file marked stale, a claim whose newest date is before today,
               unless it says "not re-checked since <date>"
     FUTURE    a time on today's block that is later than the clock
   Struck text (~~like this~~), code fences, goal sections and the file's own
   self-describing preamble are not read.

   Before trusting it:
     1. node check-evidence.js --self-test
     2. node check-evidence.js           against the real files
     3. Read every flag. Name the false alarms. Tune CLAIM, EVIDENCE, TARGETS.
     4. Run it again.

   Run: node check-evidence.js            all targets
        node check-evidence.js --hook     for a Claude Code hook (exit 2 on a problem)
        node check-evidence.js --self-test */
const fs = require('fs'), path = require('path');
const ROOT = __dirname;

/* EDIT FOR EACH PROJECT. The files that state what is true now, and any file
   that reports results. `stale: true` means a claim dated before today counts
   as unchecked. NEXT.md records where work stopped, so it is dated by nature. */
const TARGETS = [
  { file: 'STATUS.md', stale: true },
  { file: 'NEXT.md',   stale: false },
];

const CLAIM    = /\b(verified|tested|every step|all steps|performable|walked|works|renders|fits|no errors?|passes|passed)\b/i;
/* A checksum, or a commit in backticks, names where the result can be read. */
const EVIDENCE = /Evidence:|\bmeasured\b|\btried\b|\bclicked\b|\bnot (checked|looked at|run|tried|re-checked)\b|\b\d{1,2}:\d{2}\b|check-[a-z-]+\.js|\bchecksum\b|\bmd5\b|\bsha-?\d+\b|`(?=[0-9a-f]*\d)[0-9a-f]{7,40}`/i;
const NEGATED  = /\b(not|no|never|nothing|nobody|none|cannot|until|once)\b[^.;:]{0,30}$/i;
/* A claim word right after a code name describes the code: "`Play.tsx` renders it". */
const CODE_SUBJECT = /`[^`\n]+`\s*$/;
/* A goal is not a result. */
const GOAL_HEADING = /^#+\s*(Next|Expected|Goal|Plan)\b/i;
/* The self-describing sections describe the file, not the project. */
const PREAMBLE_HEADING = /^#+\s*(Purpose of this file|What belongs here|What does not belong here|Rules|When to update|Relationship to other files|When asked)\b/i;
/* A dated log of what was done. Its entries are old by nature, so STALE does not
   apply there; an entry with no evidence at all is still UNBACKED. */
const HISTORY_HEADING = /^#+\s*(Recently Completed|Completed)\b/i;
/* An intention, not a report: "should be re-verified", "to be tested". */
const INTENT   = /(\bre-|\b(should|must|to|will|needs? to|would) be\s+)$/i;
/* "passes" as the noun of the ten-pass rule is not a claim. */
const NOUN_PASS = /(\bthe|\bten|\bthree|\bof|\bset of)\s+$/i;
const MON = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };

function now() {
  const d = new Date();
  return { date: d.toLocaleDateString('sv-SE'), hm: d.toTimeString().slice(0, 5) };
}

function datesIn(t) {
  const out = [];
  for (const m of t.matchAll(/\b(20\d\d)-(\d\d)-(\d\d)\b/g)) out.push(m[0]);
  for (const m of t.matchAll(/\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (20\d\d)\b/gi))
    out.push(m[3] + '-' + String(MON[m[2].slice(0,3).toLowerCase()]).padStart(2,'0') + '-' + m[1].padStart(2,'0'));
  return out.sort();
}

/* A block is a paragraph, a list item or a table row. */
function blocks(text) {
  const out = []; let cur = null, fence = false, skip = false, history = false;
  const flush = () => { if (cur) out.push(cur); cur = null; };
  text.split('\n').forEach((l, i) => {
    if (/^\s*```/.test(l)) { fence = !fence; flush(); return; }
    if (fence) return;
    if (/^#/.test(l)) { flush(); skip = GOAL_HEADING.test(l) || PREAMBLE_HEADING.test(l); history = HISTORY_HEADING.test(l); return; }
    if (!l.trim()) { flush(); return; }
    if (skip) return;
    if (/^\s*\|/.test(l)) { flush(); out.push({ line: i + 1, text: l, history }); return; }
    if (/^\s*([-*]|\d+\.)\s/.test(l)) { flush(); cur = { line: i + 1, text: l, history }; return; }
    if (cur) cur.text += ' ' + l.trim(); else cur = { line: i + 1, text: l, history };
  });
  flush();
  return out;
}

function checkText(text, file, stale, t) {
  const problems = [];
  blocks(text).forEach(b => {
    const live = b.text.replace(/~~[\s\S]*?~~/g, '');
    let claim = null;
    for (const m of live.matchAll(new RegExp(CLAIM.source, 'gi'))) {
      const before = live.slice(0, m.index);
      if (NEGATED.test(before) || INTENT.test(before) || CODE_SUBJECT.test(before)) continue;
      if (/^passes$/i.test(m[0]) && NOUN_PASS.test(before)) continue;
      claim = m[0]; break;
    }
    /* A date after today is a deadline the text names, not when it was checked. */
    const dates = datesIn(live).filter(d => d <= t.date);
    const newest = dates[dates.length - 1];
    const say = (kind, why) => problems.push(`${kind.padEnd(8)} ${file}:${b.line}  ${why}\n         > ${live.trim().slice(0, 160)}`);

    if (newest === t.date)
      for (const m of live.matchAll(/\b(?:at|between|and)\s+(\d{2}):(\d{2})\b/g))
        if (`${m[1]}:${m[2]}` > t.hm) say('FUTURE', `time ${m[1]}:${m[2]} is later than the clock, ${t.hm}`);

    if (!claim) return;
    if (!EVIDENCE.test(live)) return say('UNBACKED', `"${claim}" with no time, measurement or "not checked"`);
    if (stale && !b.history && newest && newest < t.date && !/not re-checked since/i.test(live))
      say('STALE', `"${claim}" last dated ${newest}; measure again or write "not re-checked since ${newest}"`);
  });
  return problems;
}

/* A check is only evidence if it fails on what it exists to catch. */
function selfTest() {
  const t = { date: '2026-09-13', hm: '12:00' };
  const cases = [
    ['- Every step is performable.', true],
    ['- Measured at 11:40: every step performable.', false],
    ['- Every step performable. Not checked at 280px.', false],
    ['- Step 2 was not performable.', false],
    ['- Measured 2026-09-12 at 10:00: it works.', true],
    ['- Measured 2026-09-12 at 10:00: it works, not re-checked since 2026-09-12.', false],
    ['- Measured 2026-09-13 at 13:30: it works.', true],
    ['- The licence should be re-verified before shipping.', false],
    ['- It needs to be tested at 280px.', false],
    ['- Then running the passes over the slice.', false],
    ['- The slice passes.', true],
    ['- ~~Every step is performable.~~ Removed.', false],
    /* tuned on the first installs, 2026-09-13 */
    ['- Every run since has added output nobody has verified.', false],
    ['- Copied in, verified identical by checksum.', false],
    ['- Every question verified on 512 play-outs (`4c89cc1`).', false],
    ['- 2026-09-12: the app renders offline (commit `804a911`).', true],
    ['- `web/src/Play.tsx` renders it.', false],
    ['- The page renders 25 records.', true],
    /* a history section is dated by nature */
    ['## Recently Completed\n\n- 2026-09-11: every question verified on 512 play-outs (`4c89cc1`).', false],
    ['## Recently Completed\n\n- 2026-09-11: every question verified.', true],
    ['## Verified\n\n- 2026-09-11: every question verified on 512 play-outs (`4c89cc1`).', true],
  ];
  let bad = 0;
  cases.forEach(([line, fails]) => {
    const got = checkText(line + '\n', 'test', true, t).length > 0;
    if (got !== fails) { bad++; console.log('WRONG  expected ' + (fails ? 'a flag' : 'no flag') + ': ' + line); }
  });
  console.log(`${cases.length - bad} of ${cases.length} self-test lines judged right`);
  return bad === 0;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) process.exit(selfTest() ? 0 : 1);
  const hook = args.includes('--hook');
  let targets = TARGETS;
  if (hook) {
    let j = {};
    try { j = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch (e) {}
    const fp = j.tool_input && j.tool_input.file_path;
    if (fp) {
      targets = TARGETS.filter(x => path.resolve(ROOT, x.file) === path.resolve(fp));
      if (!targets.length) process.exit(0);
    }
  }
  const t = now();
  const problems = targets.flatMap(x => {
    const f = path.join(ROOT, x.file);
    return fs.existsSync(f) ? checkText(fs.readFileSync(f, 'utf8'), x.file, x.stale, t) : [];
  });
  const out = hook ? s => process.stderr.write(s + '\n') : console.log;
  problems.forEach(p => out(p));
  out(`${problems.length} unbacked, stale or future claims in ${targets.length} files, read at ${t.hm}`);
  if (problems.length) process.exit(hook ? 2 : 1);
}
main();
