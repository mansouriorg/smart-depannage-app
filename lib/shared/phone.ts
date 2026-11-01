/**
 * Telephone numbers, written the Tunisian way (P1-16).
 *
 * A customer types "22 123 456", "22.123.456", "0022122123456", "+216 22 123 456" or "٢٢ ١٢٣ ٤٥٦". The server
 * keeps one spelling, "+21622123456" (E.164): it is what an SMS gateway wants, and what tells two spellings of
 * one number apart from two numbers. The form sends that spelling, so the number the customer sees on the
 * confirmation is the one the link will be texted to.
 *
 * A Tunisian number has 8 digits after the country code 216, the first one from 2 to 9. A number written with
 * another country code (a customer abroad who books for family) is kept as written, in full. Anything else is
 * refused, with a sentence a person can act on. The server normalizes again (notifications/delivery/contact.ts
 * there): this is for the form, so a mistake is told before the request is sent.
 */

import { DEFAULT_LOCALE, type Locale } from './generated/i18n';
import { message } from './i18n';
import { isolateFor } from './words';

export type PhoneCheck = { ok: true; e164: string; display: string } | { ok: false; reason: 'empty' | 'invalid' };

const COUNTRY = '216';
const TUNISIAN_NATIONAL = /^[2-9]\d{7}$/;
const FOREIGN_FULL = /^[1-9]\d{8,14}$/;

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits written as 0-9: the Arabic keyboard types these. */
function asciiDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (char) => String(char.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (char) => String(char.charCodeAt(0) - 0x06f0));
}

function tunisian(afterCountryCode: string): PhoneCheck {
  // "+216 0 22123456": a national "0" written after the country code is not part of the number.
  const national = afterCountryCode.replace(/^0+/, '');

  if (!TUNISIAN_NATIONAL.test(national)) return { ok: false, reason: 'invalid' };

  return { ok: true, e164: `+${COUNTRY}${national}`, display: `+${COUNTRY} ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}` };
}

export function normalizePhone(raw: unknown): PhoneCheck {
  if (typeof raw !== 'string') return { ok: false, reason: 'empty' };

  const compact = asciiDigits(raw).trim().replace(/[\s().\-]/g, '');

  if (!compact) return { ok: false, reason: 'empty' };

  const written = compact.startsWith('00') ? `+${compact.slice(2)}` : compact;
  const plus = written.startsWith('+');
  const digits = plus ? written.slice(1) : written;

  if (!/^\d+$/.test(digits)) return { ok: false, reason: 'invalid' };

  if (plus) {
    if (digits.startsWith(COUNTRY)) return tunisian(digits.slice(COUNTRY.length));

    return FOREIGN_FULL.test(digits) ? { ok: true, e164: `+${digits}`, display: `+${digits}` } : { ok: false, reason: 'invalid' };
  }

  // "21622123456": the country code is already there (a national number is 8 digits, so 11 or more start with it).
  if (digits.length >= COUNTRY.length + 8 && digits.startsWith(COUNTRY)) return tunisian(digits.slice(COUNTRY.length));

  return tunisian(digits);
}

/** The sentence under a phone field, or null when the number is good. */
export function phoneProblem(raw: unknown, locale: Locale = DEFAULT_LOCALE): string | null {
  const check = normalizePhone(raw);

  if (check.ok) return null;

  return check.reason === 'empty'
    ? message(locale, 'guest.problems.phoneRequired')
    : message(locale, 'guest.problems.phoneInvalid', { example: isolateFor(locale, '22 123 456') });
}

/** "+21622123456" as "+216 22 123 456"; anything else as it is. */
export function formatPhone(value: string | null | undefined): string {
  const text = String(value ?? '').trim();
  const check = text.startsWith('+') ? normalizePhone(text) : { ok: false as const };

  return check.ok ? check.display : text;
}
