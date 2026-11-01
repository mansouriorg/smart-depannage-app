import { coordinatesOf, message, tradeLabel, tradesNamedBy, type ArtisanSelf, type Locale } from '../lib/shared';
import { formatDate, joinList } from './i18n-core';

/** The letters in the round avatar: the first letter of the first two words of the name ("Ahmed Ben Salah" → "AB"). */
export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);

  if (!words.length) return 'SD';

  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0].toUpperCase())
    .join('');
}

/** The first word of the name, for "Bonjour, Ahmed". */
export function firstNameOf(name: string | null | undefined): string | null {
  const first = (name ?? '').trim().split(/\s+/)[0];

  return first || null;
}

/** The average rating with one decimal, or a dash while nobody has rated the artisan yet. */
export function ratingText(average: number | null | undefined, count: number | null | undefined): string {
  if (!count || typeof average !== 'number' || !Number.isFinite(average)) return '–';

  return average.toFixed(1);
}

/** "Octobre 2026" / "أكتوبر 2026", for "member since". Null when the date is missing or not a date. */
export function memberSince(iso: string | null | undefined, locale: Locale): string | null {
  if (!iso) return null;

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return null;

  const text = formatDate(date, locale, { month: 'long', year: 'numeric' });

  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A specialty is stored as the name of a trade ("Plombier"): in Arabic it is shown with the Arabic name of that trade. */
function specialtyText(text: string, locale: Locale): string {
  if (locale === 'fr') return text;

  const named = tradesNamedBy(text);

  return named.length === 1 ? tradeLabel(named[0], locale) : text;
}

/** What the artisan does: their trades, or their main one, or the generic title. */
export function tradesText(self: Pick<ArtisanSelf, 'specialties' | 'specialty'> | null | undefined, locale: Locale): string {
  const list = (self?.specialties ?? []).map((trade) => trade.trim()).filter(Boolean);

  if (list.length) return joinList(list.map((trade) => specialtyText(trade, locale)), locale);

  const main = self?.specialty?.trim();

  return main ? specialtyText(main, locale) : message(locale, 'app.common.technician');
}

/** What to tell an artisan whose profile is not approved yet (they cannot take missions), or null when it is. */
export function verificationNotice(status: string | null | undefined, locale: Locale): string | null {
  switch (status) {
    case 'APPROVED':
      return null;
    case 'PENDING_REVIEW':
      return message(locale, 'app.profile.notice.pendingReview');
    case 'REJECTED':
      return message(locale, 'app.profile.notice.rejected');
    case 'SUSPENDED':
      return message(locale, 'app.profile.notice.suspended');
    case 'DRAFT':
      return message(locale, 'app.profile.notice.draft');
    default:
      return null;
  }
}

/** "Lun. 19 oct." */
export function shortDate(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return '';

  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? '' : formatDate(date, locale, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** The year of a moment in the time of Tunis, or on the clock of the phone when it has no time-zone data. */
function yearInTunis(date: Date): number {
  try {
    return Number(date.toLocaleString('en-US', { timeZone: 'Africa/Tunis', year: 'numeric' }));
  } catch {
    return date.getFullYear();
  }
}

/**
 * "24 oct., 14:02", in the time of Tunis (the time a customer and an artisan of Tunisia read on their clocks). A moment of another
 * year than `now`'s carries its year ("24 oct. 2025, 14:02"): a line of a ledger can be older than a year.
 */
export function shortDateTime(iso: string | null | undefined, locale: Locale, now: Date = new Date()): string {
  if (!iso) return '';

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return '';

  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };

  if (yearInTunis(date) !== yearInTunis(now)) options.year = 'numeric';

  // A phone without time-zone data still shows the moment, on its own clock (formatDate falls back by itself).
  return formatDate(date, locale, options);
}

/** "09:05" */
export function clockTime(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return '';

  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? '' : formatDate(date, locale, { hour: '2-digit', minute: '2-digit' });
}

/** A point as text, for the place the artisan was last put on the map: "36.80650, 10.18150". */
export function coordinatesText(point: { latitude: number; longitude: number }): string {
  return `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
}

/**
 * The position the server holds for the artisan, as text, or null when it holds none that can be used (nothing,
 * not numbers, outside the globe, or the 0,0 of "nothing filled in").
 */
export function coordinatesOnFile(latitude: unknown, longitude: unknown): string | null {
  const point = coordinatesOf({ latitude, longitude });

  return point ? coordinatesText(point) : null;
}
