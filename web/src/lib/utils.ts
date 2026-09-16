import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }

/**
 * A list of reasons as sentences: each starts with a capital and ends with a full stop.
 *
 * Reasons used to be strung together with middle dots, which Changs banned on 2026-09-16. A comma
 * will not do, because a single reason often has a comma of its own ("3 tile kinds would still
 * improve you, 5 of them live"), and a list of commas then reads as one long reason.
 */
export function sentences(reasons: string[]): string {
  return reasons
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => r.charAt(0).toUpperCase() + r.slice(1) + (/[.!?]$/.test(r) ? '' : '.'))
    .join(' ');
}
