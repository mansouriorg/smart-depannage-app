import { DEFAULT_LOCALE, type Locale } from './generated/i18n';
import { STATUS_GROUPS, canonicalStatus, type CanonicalStatus, type StatusGroup } from './generated/intervention-status';
import type { TrackingIntervention } from './generated/views';
import { GUEST_LIMITS } from './guest';
import { message } from './i18n';
import { statusGroupOf, type StatusTone } from './status';

/**
 * The tracking page of a visitor (P1-16): what each status says to the customer, how far the job is, when the page asks
 * the server again, and which actions the page offers.
 *
 * Every status has its own sentence (the catalogue has the key of each `CanonicalStatus`, French and Arabic: a status added on the server
 * stops this file from compiling until it has words there), and a status nobody knows still gets a page that says so, never a blank card.
 */

/** The page asks the server again this often while it is shown. A change is on screen within this time plus one request. */
export const TRACKING_REFRESH_MS = 20_000;

/** After repeated failures the page slows down, to this at most. */
export const TRACKING_RETRY_MAX_MS = 120_000;

export interface VisitorStatus {
  /** The canonical status, or null when the server sent one this copy does not know. */
  status: CanonicalStatus | null;
  group: StatusGroup | null;
  title: string;
  message: string;
  tone: StatusTone;
}

/** The tone of each status on the page; the words are in the catalogue (`tracking.status.*`). */
const TONE: Record<CanonicalStatus, StatusTone> = {
  CREATED: 'waiting',
  WAITING_ADMIN_REVIEW: 'waiting',
  QUOTE_SENT: 'waiting',
  QUOTE_ACCEPTED: 'waiting',
  ASSIGNED: 'info',
  ARTISAN_ACCEPTED: 'info',
  ARTISAN_ON_THE_WAY: 'active',
  ARTISAN_ARRIVED: 'active',
  IN_PROGRESS: 'active',
  WAITING_CLIENT_VALIDATION: 'warning',
  COMPLETED: 'success',
  PAYMENT_PENDING: 'warning',
  PAID: 'success',
  INVOICE_SENT: 'success',
  CANCELLED: 'danger',
  DISPUTED: 'danger',
};

/** The words of a status for the customer, whichever spelling it came in, in the language asked (French when it is left out). */
export function visitorStatus(status: string | null | undefined, locale: Locale = DEFAULT_LOCALE): VisitorStatus {
  const canonical = canonicalStatus(status);

  if (!canonical) {
    return {
      status: null,
      group: null,
      // Never the raw code of a status this copy does not know: it would mean nothing to a customer.
      title: message(locale, 'tracking.status.unknown.title'),
      message: message(locale, 'tracking.status.unknown.message'),
      tone: 'waiting',
    };
  }

  return {
    status: canonical,
    group: statusGroupOf(canonical),
    title: message(locale, `tracking.status.${canonical}.title`),
    message: message(locale, `tracking.status.${canonical}.message`),
    tone: TONE[canonical],
  };
}

// ----------------------------------------------------------
// How far the job is
// ----------------------------------------------------------

/** The ids of the five steps, in order; their words are `tracking.steps.*`. */
const STEP_IDS = ['received', 'assigned', 'onTheWay', 'intervention', 'done'] as const;

/** The words of the five steps in a language. */
export function trackingStepLabels(locale: Locale = DEFAULT_LOCALE): string[] {
  return STEP_IDS.map((id) => message(locale, `tracking.steps.${id}`));
}

/** The five steps in French (the other languages: `trackingStepLabels`). */
export const TRACKING_STEPS = trackingStepLabels('fr') as readonly string[];

/** Where each status stands among TRACKING_STEPS (0 to 4). Cancelled and disputed jobs have no place on the way. */
const STEP_OF: Record<CanonicalStatus, number | null> = {
  CREATED: 0,
  WAITING_ADMIN_REVIEW: 0,
  QUOTE_SENT: 0,
  QUOTE_ACCEPTED: 0,
  ASSIGNED: 1,
  ARTISAN_ACCEPTED: 1,
  ARTISAN_ON_THE_WAY: 2,
  ARTISAN_ARRIVED: 2,
  IN_PROGRESS: 3,
  WAITING_CLIENT_VALIDATION: 3,
  COMPLETED: 4,
  PAYMENT_PENDING: 4,
  PAID: 4,
  INVOICE_SENT: 4,
  CANCELLED: null,
  DISPUTED: null,
};

export interface TrackingStep {
  label: string;
  state: 'done' | 'current' | 'todo';
}

/** The five steps with where the job stands; `halted` is set (and no step is current) for a cancelled or disputed job. */
export function trackingProgress(
  status: string | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): { steps: TrackingStep[]; halted: 'cancelled' | 'disputed' | null } {
  const canonical = canonicalStatus(status);
  const at = canonical ? STEP_OF[canonical] : null;
  const labels = trackingStepLabels(locale);

  const steps = labels.map<TrackingStep>((label, index) => ({
    label,
    // The last step is a result, not something in progress: a finished job has them all done.
    state: at === null ? 'todo' : index < at || (at === labels.length - 1 && index === at) ? 'done' : index === at ? 'current' : 'todo',
  }));

  return { steps, halted: canonical === 'CANCELLED' ? 'cancelled' : canonical === 'DISPUTED' ? 'disputed' : null };
}

// ----------------------------------------------------------
// When the page asks again
// ----------------------------------------------------------

/**
 * Milliseconds until the next refresh, or null when the page should not refresh (it is hidden: it refreshes the moment
 * it is shown again if the last answer is older than TRACKING_REFRESH_MS, see `isStale`). One failed try is retried at
 * the usual pace; further ones double the wait, up to TRACKING_RETRY_MAX_MS.
 */
export function nextRefreshDelay(state: { hidden: boolean; failures: number }): number | null {
  if (state.hidden) return null;

  const failures = Math.max(0, Math.floor(state.failures));

  if (failures <= 1) return TRACKING_REFRESH_MS;

  return Math.min(TRACKING_RETRY_MAX_MS, TRACKING_REFRESH_MS * 2 ** (failures - 1));
}

/** True when the last good answer is old enough that a page that was hidden should ask again as soon as it is shown. */
export function isStale(lastAnswerAt: number | null, now: number): boolean {
  return lastAnswerAt === null || now - lastAnswerAt >= TRACKING_REFRESH_MS;
}

/** The sentence a screen reader announces when the status changes, or null when it did not (the same status in another spelling is not a change). */
export function statusChangeNotice(before: string | null | undefined, after: string | null | undefined, locale: Locale = DEFAULT_LOCALE): string | null {
  const previous = canonicalStatus(before) ?? before ?? null;
  const next = canonicalStatus(after) ?? after ?? null;

  if (previous === next || !after) return null;

  return message(locale, 'tracking.notice', { title: visitorStatus(after, locale).title });
}

// ----------------------------------------------------------
// What the page offers
// ----------------------------------------------------------

type JobLike = Pick<TrackingIntervention, 'status' | 'photos' | 'rating'> & { review?: unknown };

/** Pictures can be added while the request is open (waiting or being handled), until it holds 6. */
export function canAddPhotos(job: Pick<JobLike, 'status' | 'photos'>): boolean {
  const group = statusGroupOf(job.status);

  return (group === 'waiting' || group === 'active') && (job.photos?.length ?? 0) < GUEST_LIMITS.photosTotal;
}

/** The customer already gave an opinion (a review, or a rating written by the older route). */
export function hasGivenFeedback(job: Pick<JobLike, 'rating' | 'review'>): boolean {
  return Boolean(job.review) || (job.rating !== null && job.rating !== undefined);
}

/** An opinion is asked for once the job is finished and none has been given. */
export function canGiveFeedback(job: JobLike): boolean {
  return (STATUS_GROUPS.completed as readonly string[]).includes(canonicalStatus(job.status) ?? '') && !hasGivenFeedback(job);
}
