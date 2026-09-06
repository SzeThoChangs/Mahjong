/**
 * Jargon, marked once and rendered everywhere.
 *
 * The app's own words for the game are written `*like this*` in card text and UI strings, and this
 * gives them their own weight on the page. Two reasons for marking rather than styling in place. The terms are
 * spread across tips cards, drill prompts and explanations, and a term that is italic on one screen
 * and plain on the next reads as two different words. And the set of terms is still being agreed,
 * so it has to be cheap to add one: write the asterisks, and every screen that renders text through
 * here picks it up.
 *
 * Deliberately not markdown. It handles exactly one thing, so a stray asterisk in a hand notation
 * cannot turn half a sentence into emphasis.
 */
import { Fragment, type ReactNode } from 'react';

/** Split on `*term*` and mark the terms. Anything else is returned unchanged. */
export function jargon(text: string): ReactNode {
  if (!text.includes('*')) return text;
  const parts = text.split(/\*([^*]+)\*/g);
  return parts.map((p, i) => (i % 2 === 1 ? <J key={i}>{p}</J> : <Fragment key={i}>{p}</Fragment>));
}

/**
 * The same mark, for text written as JSX rather than as a string.
 *
 * The page copy outside the cards is written straight into the markup, often around a `<b>` or an
 * interpolated number, so there is no string for `jargon` to split. Wrapping the term in `<J>`
 * keeps one definition of what a marked term looks like.
 */
export function J({ children }: { children: ReactNode }) {
  return <em className="not-italic font-medium text-foreground/90">{children}</em>;
}
