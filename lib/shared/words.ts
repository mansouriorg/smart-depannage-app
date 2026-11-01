import { DEFAULT_LOCALE, isolate, type Locale } from './generated/i18n';
import { message } from './i18n';

/**
 * Helpers for the words that the shared rules build (P3-04): a value put in a sentence, and a count with its noun.
 *
 * A function of the package that returns only a value (an amount, an hour, a phone number) returns it plain: the screen sets it apart
 * (`dir="ltr"`, `<bdi>`, `writingDirection: 'ltr'`). A function that returns a sentence with a value inside sets the value apart itself
 * in Arabic, where a number or a Latin word would otherwise move around in a right-to-left line, and leaves French alone.
 */

/** A value to put inside a sentence of `locale`: between isolate marks in Arabic, untouched in French. */
export function isolateFor(locale: Locale, value: string | number): string {
  return locale === 'ar' ? isolate(value) : String(value);
}

/**
 * A value that must read left to right as a whole, sign included ("+23,800 د.ت"), put inside a sentence of `locale`: between left-to-right
 * isolate marks in Arabic, untouched in French. (`isolateFor` lets the value's first letter decide; for a figure with a sign in front,
 * that would put the sign at the wrong end.)
 */
export function ltrFor(locale: Locale, value: string | number): string {
  return locale === 'ar' ? `\u2066${value}\u2069` : String(value);
}

/** "10 caractères" / "10 أحرف": a limit written in a sentence, with its noun in agreement. */
export function charactersText(count: number, locale: Locale = DEFAULT_LOCALE): string {
  return message(locale, 'common.characters', { count });
}

/** "6 photos" / "6 صور", "aucune photo" for none. */
export function photosText(count: number, locale: Locale = DEFAULT_LOCALE): string {
  return message(locale, 'common.photos', { count });
}
