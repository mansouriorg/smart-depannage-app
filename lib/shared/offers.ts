import type { Locale } from './generated/i18n';
import type { BoardIntervention } from './generated/views';
import { apiErrorStatus } from './errors';
import { message } from './i18n';
import { isolateFor } from './words';

/**
 * A mission offered to several technicians at once, first to accept wins (P3-07): the rules the phone app and its tests share.
 *
 * The server (smart-depannage-serveur: modules/mission-offers) offers an open job to the best-matched technicians who are free, each for a few
 * minutes. `GET /artisans/me/offers` lists the signed-in technician's own offers with the server's clock; the phone counts down on its own clock
 * corrected by the difference between the two (a phone whose clock is five minutes off must not show five minutes too many or too few).
 *
 * The server judges every answer; what the phone shows is a courtesy: an offer whose time has run out on the phone's corrected clock is drawn as
 * expired at once, and the accept it would still make is refused by the server.
 */

/** What an offer is called when it is read. `open` is the only state in which it can still be answered. */
export type OfferState = 'open' | 'accepted' | 'declined' | 'expired' | 'withdrawn';

/** Why a withdrawn offer was withdrawn. `closed`: the job is not open any more and nobody recorded why. */
export type OfferBecause = 'taken' | 'assigned' | 'cancelled' | 'staff' | 'closed';

/** An offer as the technician it was made to reads it: what it is and when. Never the rank, the score or the other technicians asked. */
export interface OfferRead {
  id: number;
  interventionId: number;
  state: OfferState;
  because: OfferBecause | null;
  offeredAt: string | null;
  expiresAt: string | null;
  respondedAt: string | null;
}

/** The job of an open offer is the board's copy with the distance; an offer that ended carries only the job's number and its trade. */
export type OfferedJob = (BoardIntervention & { distanceKm: number | null }) | { id: number; serviceType: string };

export interface MyOffer extends OfferRead {
  job: OfferedJob | null;
}

/** What `GET /artisans/me/offers` answers. `now` is the server's clock. */
export interface MyOffers {
  now: string;
  offers: MyOffer[];
}

/** How often the phone asks the server again while an offer is open and the app is in front: the answer is how a withdrawal reaches a phone (it has no live connection). */
export const OFFER_POLL_MS = 15_000;

/** How often it asks while no offer is open (a new offer also arrives as a push): slowly, so that an app left open does not spend the battery. */
export const OFFER_IDLE_POLL_MS = 30_000;

/** An offer that ended is still shown on the home screen this long (milliseconds) after it ended, so that "taken by another technician" is read, not just found missing. */
export const ENDED_OFFER_SHOWN_MS = 2 * 3_600_000;

/** The most ended offers the home screen shows. */
export const MAX_ENDED_OFFERS_SHOWN = 3;

/** An offer with less than this left is drawn as urgent. */
export const OFFER_URGENT_MS = 60_000;

const STATES: readonly OfferState[] = ['open', 'accepted', 'declined', 'expired', 'withdrawn'];
const BECAUSE: readonly OfferBecause[] = ['taken', 'assigned', 'cancelled', 'staff', 'closed'];

const timeOf = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;

  // A number goes through `Date` too: a figure no date can hold (1e20) is not a time, and a later `toISOString()` would throw on it.
  const time = new Date(value as string | number).getTime();

  return Number.isFinite(time) ? time : null;
};

/**
 * The answer of `GET /artisans/me/offers` as the screens keep it: only the fields they read, an offer of an unknown state left out (a state of
 * tomorrow is not guessed at), and a job that is not an object dropped.
 */
export function slimOffers(raw: unknown): MyOffers | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const { now, offers } = raw as { now?: unknown; offers?: unknown };

  if (timeOf(now) === null || !Array.isArray(offers)) return null;

  const kept: MyOffer[] = [];

  for (const item of offers) {
    if (!item || typeof item !== 'object') continue;

    const row = item as Record<string, unknown>;

    if (!Number.isInteger(row.id) || !Number.isInteger(row.interventionId) || !STATES.includes(row.state as OfferState)) continue;

    kept.push({
      id: row.id as number,
      interventionId: row.interventionId as number,
      state: row.state as OfferState,
      because: BECAUSE.includes(row.because as OfferBecause) ? (row.because as OfferBecause) : null,
      offeredAt: typeof row.offeredAt === 'string' ? row.offeredAt : null,
      expiresAt: typeof row.expiresAt === 'string' ? row.expiresAt : null,
      respondedAt: typeof row.respondedAt === 'string' ? row.respondedAt : null,
      job: row.job && typeof row.job === 'object' && !Array.isArray(row.job) ? (row.job as OfferedJob) : null,
    });
  }

  // The server writes an ISO string; a number of milliseconds is read too, and kept as one.
  return { now: typeof now === 'number' ? new Date(now).toISOString() : String(now), offers: kept };
}

/**
 * How far the server's clock is ahead of the phone's, in milliseconds, from an answer that carries `now`: `phoneNow` is the phone's clock when the
 * answer arrived. null when the server's time cannot be read (the phone then uses its own clock as it is).
 */
export function clockOffset(serverNow: unknown, phoneNow: number): number | null {
  const server = timeOf(serverNow);

  return server === null || !Number.isFinite(phoneNow) ? null : server - phoneNow;
}

/**
 * How long an offer has left, in milliseconds, never below 0. An offer with no readable end has none left: it must never be shown as open for ever.
 * The clock offset is bounded to a day, so that a corrupt value cannot make an offer last a year.
 */
export function msLeft(expiresAt: unknown, phoneNow: number, offset: number | null = 0): number {
  const end = timeOf(expiresAt);

  if (end === null || !Number.isFinite(phoneNow)) return 0;

  const shift = offset !== null && Number.isFinite(offset) ? Math.max(-86_400_000, Math.min(86_400_000, offset)) : 0;

  return Math.max(0, end - (phoneNow + shift));
}

/** The state to draw: an open offer whose time has run out on the corrected clock is expired already, without waiting for the next read. */
export function stateNow(offer: Pick<OfferRead, 'state' | 'expiresAt'>, phoneNow: number, offset: number | null = 0): OfferState {
  if (offer.state !== 'open') return offer.state;

  return msLeft(offer.expiresAt, phoneNow, offset) > 0 ? 'open' : 'expired';
}

/** True while the offer can still be answered. */
export function isOpenNow(offer: Pick<OfferRead, 'state' | 'expiresAt'>, phoneNow: number, offset: number | null = 0): boolean {
  return stateNow(offer, phoneNow, offset) === 'open';
}

/** True when an open offer is about to run out. */
export function isUrgent(ms: number): boolean {
  return Number.isFinite(ms) && ms > 0 && ms < OFFER_URGENT_MS;
}

/** "9:41" under an hour, "1:59:59" above: Latin digits in both languages (a time is read as a figure), the seconds rounded up so that 0:00 means over. */
export function countdownText(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.ceil(ms / 1000) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const two = (value: number) => String(value).padStart(2, '0');

  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${minutes}:${two(seconds)}`;
}

/** "Il reste 9:41" / "المتبقّي 9:41": the figure set apart in Arabic. */
export function timeLeftText(locale: Locale, ms: number): string {
  return message(locale, 'app.offers.left', { time: isolateFor(locale, countdownText(ms)) });
}

/** The same for a screen reader. */
export function timeLeftAccessibility(locale: Locale, ms: number): string {
  return message(locale, 'app.offers.leftAccessibility', { time: isolateFor(locale, countdownText(ms)) });
}

/** "à 4,2 km" / "على بُعد 4,2 كم": nothing when the distance is not known. */
export function awayText(locale: Locale, km: number | null | undefined): string | null {
  if (typeof km !== 'number' || !Number.isFinite(km) || km < 0) return null;

  const figure = String(Math.round(km * 10) / 10);

  // The decimal comma in both languages, as everywhere else in the app ("5,2 km"): a point in one screen and a comma in the next would be two ways of writing one figure.
  return message(locale, 'app.offers.away', { km: isolateFor(locale, figure.replace('.', ',')) });
}

/** The sentence for an offer that is over, by how it ended (`open` has none). */
export function outcomeText(locale: Locale, state: OfferState, because: OfferBecause | null): string | null {
  switch (state) {
    case 'accepted':
      return message(locale, 'app.offers.outcome.accepted');
    case 'declined':
      return message(locale, 'app.offers.outcome.declined');
    case 'expired':
      return message(locale, 'app.offers.outcome.expired');
    case 'withdrawn':
      switch (because) {
        case 'taken':
          return message(locale, 'app.offers.outcome.taken');
        case 'assigned':
          return message(locale, 'app.offers.outcome.assigned');
        case 'cancelled':
          return message(locale, 'app.offers.outcome.cancelled');
        case 'staff':
          return message(locale, 'app.offers.outcome.staff');
        default:
          return message(locale, 'app.offers.outcome.closed');
      }
    default:
      return null;
  }
}

/** The offers to answer now, the soonest to run out first. */
export function openOffers(offers: readonly MyOffer[], phoneNow: number, offset: number | null = 0): MyOffer[] {
  return offers
    .filter((offer) => isOpenNow(offer, phoneNow, offset))
    .sort((a, b) => msLeft(a.expiresAt, phoneNow, offset) - msLeft(b.expiresAt, phoneNow, offset));
}

/** The offers that are over (including an open one that ran out on the corrected clock), in the order the server gave them (the most recent first). */
export function endedOffers(offers: readonly MyOffer[], phoneNow: number, offset: number | null = 0): MyOffer[] {
  return offers.filter((offer) => !isOpenNow(offer, phoneNow, offset));
}

/** The technician's offer of this job, if the list has one. */
export function offerOfJob(offers: readonly MyOffer[], interventionId: number | string): MyOffer | null {
  return offers.find((offer) => String(offer.interventionId) === String(interventionId)) ?? null;
}

/** True when the server's answer to an accept or a read says the job is no longer there for this technician: taken, withdrawn, not theirs, gone. */
export function offerIsGone(error: unknown): boolean {
  const status = apiErrorStatus(error);

  return status === 403 || status === 404 || status === 409;
}

/** How long to wait before asking the server again: quickly while an offer is open, slowly otherwise. */
export function pollDelay(offers: readonly MyOffer[], phoneNow: number, offset: number | null = 0): number {
  return offers.some((offer) => isOpenNow(offer, phoneNow, offset)) ? OFFER_POLL_MS : OFFER_IDLE_POLL_MS;
}

/**
 * The offers that ended without the technician getting the job and are recent enough to tell about: ran out, or taken away (by another technician, by
 * the team, by a cancellation). The ones the technician accepted or refused themselves are not told back to them. The most recent first, at most three.
 */
export function endedOffersShown(offers: readonly MyOffer[], phoneNow: number, offset: number | null = 0): MyOffer[] {
  const endOf = (offer: MyOffer) => timeOf(offer.respondedAt) ?? timeOf(offer.expiresAt) ?? 0;
  // The corrected clock: an offer that ended a minute ago by the server's time.
  const serverNow = phoneNow + (offset !== null && Number.isFinite(offset) ? Math.max(-86_400_000, Math.min(86_400_000, offset)) : 0);

  return endedOffers(offers, phoneNow, offset)
    .map((offer) => ({ ...offer, state: stateNow(offer, phoneNow, offset) }))
    .filter((offer) => (offer.state === 'expired' || offer.state === 'withdrawn') && serverNow - endOf(offer) <= ENDED_OFFER_SHOWN_MS)
    .sort((a, b) => endOf(b) - endOf(a))
    .slice(0, MAX_ENDED_OFFERS_SHOWN);
}
