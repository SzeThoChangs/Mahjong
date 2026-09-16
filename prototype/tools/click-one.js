/**
 * Click a control only when exactly one visible control matches, and report what was pressed.
 *
 * Built 2026-09-16 at the third occurrence of MISTAKES.md M-001: a scripted click chose a control
 * by a word in its label, the page had more than one control with that word, and the script pressed
 * the wrong one. Twice it was a filter chip named like a tile; the third time a Table setup preset
 * list grew a second "compare against" list with the same names, and four clicks landed there.
 *
 * Paste into the page (or inject with a browser tool), then:
 *
 *   await clickOne(/^Doubling 2\/4\/8\/16\/32$/, { within: someContainer })
 *
 * It throws when nothing matches and when more than one does, naming every match and the nearest
 * heading above each, so the ambiguity is visible instead of silently resolved. `within` narrows
 * the search to one part of the page when the same label legitimately appears twice.
 */
window.clickOne = async function clickOne(pattern, { within = document, role = 'button,[role=tab],[role=button],a' } = {}) {
  const visible = (el) => !!el.offsetParent && el.getBoundingClientRect().width > 0;
  const label = (el) => (el.textContent || el.getAttribute('aria-label') || '').trim();
  const heading = (el) => {
    let n = el;
    while (n && n !== document.body) {
      let p = n.previousElementSibling;
      while (p) { if (/^H[1-6]$/.test(p.tagName) || p.querySelector?.('h1,h2,h3,h4,h5,h6')) return label(p).slice(0, 40); p = p.previousElementSibling; }
      n = n.parentElement;
    }
    return '(no heading)';
  };
  const matches = [...within.querySelectorAll(role)].filter((el) => visible(el) && pattern.test(label(el)));
  if (matches.length !== 1) {
    const list = matches.map((m, i) => `  ${i + 1}. "${label(m).slice(0, 50)}" under "${heading(m)}"`).join('\n');
    throw new Error(`clickOne ${pattern}: ${matches.length} visible matches, expected exactly 1${list ? '\n' + list : ''}`);
  }
  const el = matches[0];
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    el.dispatchEvent(new (type.startsWith('pointer') ? PointerEvent : MouseEvent)(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
  }
  return { pressed: label(el), under: heading(el) };
};
