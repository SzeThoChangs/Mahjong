/**
 * Jargon, marked once and rendered everywhere.
 *
 * The app's own words for the game are written `*like this*` in card text and UI strings, and this
 * turns them into italics. Two reasons for marking rather than styling in place. The terms are
 * spread across tips cards, drill prompts and explanations, and a term that is italic on one screen
 * and plain on the next reads as two different words. And the set of terms is still being agreed,
 * so it has to be cheap to add one: write the asterisks, and every screen that renders text through
 * here picks it up.
 *
 * Deliberately not markdown. It handles exactly one thing, so a stray asterisk in a hand notation
 * cannot turn half a sentence into emphasis.
 */
import { Fragment, type ReactNode } from 'react';

/** Split on `*term*` and italicise the terms. Anything else is returned unchanged. */
export function jargon(text: string): ReactNode {
  if (!text.includes('*')) return text;
  const parts = text.split(/\*([^*]+)\*/g);
  return parts.map((p, i) => (i % 2 === 1 ? <em key={i} className="not-italic font-medium text-foreground/90">{p}</em> : <Fragment key={i}>{p}</Fragment>));
}
