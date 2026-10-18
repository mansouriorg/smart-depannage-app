import tokens from './tokens.json';
import { StatusTone } from './status';

/**
 * The colours of the brand and of the statuses, written once (tokens.json).
 *
 * The two websites read them as Tailwind classes (tokens.css: `bg-gold-500`, `text-navy-900`,
 * `bg-status-waiting`); the mobile app reads them from here. tokens.css is made from tokens.json
 * by `npm run tokens`, and a test fails when the two disagree.
 */
export const colors = tokens.color;

/** The colour of a status, for a badge or a dot in the mobile app. */
export function statusColor(tone: StatusTone | null | undefined): string {
  return tone ? colors.status[tone] : colors.slate[500];
}
