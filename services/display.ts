import { coordinatesOf, type ArtisanSelf } from '../lib/shared';

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

/** "Octobre 2026", for "member since". Null when the date is missing or not a date. */
export function memberSince(iso: string | null | undefined): string | null {
  if (!iso) return null;

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return null;

  const text = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** What the artisan does: their trades, or their main one, or the generic title. */
export function tradesText(self: Pick<ArtisanSelf, 'specialties' | 'specialty'> | null | undefined): string {
  const list = (self?.specialties ?? []).map((trade) => trade.trim()).filter(Boolean);

  if (list.length) return list.join(', ');

  return self?.specialty?.trim() || 'Technicien';
}

/** What to tell an artisan whose profile is not approved yet (they cannot take missions), or null when it is. */
export function verificationNotice(status: string | null | undefined): string | null {
  switch (status) {
    case 'APPROVED':
      return null;
    case 'PENDING_REVIEW':
      return 'Votre profil est en cours de vérification par l’équipe.';
    case 'REJECTED':
      return 'Votre profil a été refusé. Contactez le support.';
    case 'SUSPENDED':
      return 'Votre profil est suspendu. Contactez le support.';
    case 'DRAFT':
      return 'Votre profil n’est pas encore complet.';
    default:
      return null;
  }
}

/** "Lun. 19 oct." */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';

  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
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
export function shortDateTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '';

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return '';

  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };

  if (yearInTunis(date) !== yearInTunis(now)) options.year = 'numeric';

  try {
    return date.toLocaleString('fr-FR', { timeZone: 'Africa/Tunis', ...options });
  } catch {
    // A phone without time-zone data still shows the moment, on its own clock.
    return date.toLocaleString('fr-FR', options);
  }
}

/** "09:05" */
export function clockTime(iso: string | null | undefined): string {
  if (!iso) return '';

  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
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
