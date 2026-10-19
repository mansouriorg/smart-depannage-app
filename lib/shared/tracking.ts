import { STATUS_GROUPS, canonicalStatus, type CanonicalStatus, type StatusGroup } from './generated/intervention-status';
import type { TrackingIntervention } from './generated/views';
import { GUEST_LIMITS } from './guest';
import { statusGroupOf, type StatusTone } from './status';

/**
 * The tracking page of a visitor (P1-16): what each status says to the customer, how far the job is, when the page asks
 * the server again, and which actions the page offers.
 *
 * Every status has its own sentence (`Record<CanonicalStatus, …>`: a status added on the server stops this file from
 * compiling until it has words here), and a status nobody knows still gets a page that says so, never a blank card.
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

type Words = { title: string; message: string; tone: StatusTone };

const WORDS: Record<CanonicalStatus, Words> = {
  CREATED: {
    title: 'Demande reçue',
    message: 'Nous avons bien reçu votre demande. Notre équipe va l’examiner.',
    tone: 'waiting',
  },
  WAITING_ADMIN_REVIEW: {
    title: 'Vérification en cours',
    message: 'Notre équipe vérifie votre demande et cherche le technicien qui conviendra.',
    tone: 'waiting',
  },
  QUOTE_SENT: {
    title: 'Devis établi',
    message: 'Un devis a été établi pour votre demande. Notre équipe vous contactera à ce sujet.',
    tone: 'waiting',
  },
  QUOTE_ACCEPTED: {
    title: 'Devis accepté',
    message: 'Votre devis est accepté. Nous cherchons le technicien qui interviendra.',
    tone: 'waiting',
  },
  ASSIGNED: {
    title: 'Technicien désigné',
    message: 'Un technicien a été désigné pour votre demande. Il doit encore confirmer.',
    tone: 'info',
  },
  ARTISAN_ACCEPTED: {
    title: 'Technicien confirmé',
    message: 'Votre technicien a confirmé l’intervention et se prépare à partir.',
    tone: 'info',
  },
  ARTISAN_ON_THE_WAY: {
    title: 'Technicien en route',
    message: 'Votre technicien est en route vers l’adresse indiquée.',
    tone: 'active',
  },
  ARTISAN_ARRIVED: {
    title: 'Technicien sur place',
    message: 'Votre technicien est arrivé à l’adresse.',
    tone: 'active',
  },
  IN_PROGRESS: {
    title: 'Intervention en cours',
    message: 'Le technicien travaille sur votre problème.',
    tone: 'active',
  },
  WAITING_CLIENT_VALIDATION: {
    title: 'Travaux terminés',
    message: 'Le technicien indique avoir terminé. Vérifiez le résultat : en cas de souci, signalez-le ci-dessous.',
    tone: 'warning',
  },
  COMPLETED: {
    title: 'Intervention terminée',
    message: 'Merci d’avoir fait appel à nous.',
    tone: 'success',
  },
  PAYMENT_PENDING: {
    title: 'Paiement en attente',
    message: 'L’intervention est terminée et le paiement est en attente. Notre équipe vous contactera si besoin.',
    tone: 'warning',
  },
  PAID: {
    title: 'Paiement enregistré',
    message: 'Votre paiement est enregistré. Merci.',
    tone: 'success',
  },
  INVOICE_SENT: {
    title: 'Facture établie',
    message: 'La facture de votre intervention a été établie.',
    tone: 'success',
  },
  CANCELLED: {
    title: 'Demande annulée',
    message: 'Cette demande a été annulée.',
    tone: 'danger',
  },
  DISPUTED: {
    title: 'Litige en cours',
    message: 'Cette demande fait l’objet d’un litige. Notre équipe vous contactera.',
    tone: 'danger',
  },
};

/** The words of a status for the customer, whichever spelling it came in. */
export function visitorStatus(status: string | null | undefined): VisitorStatus {
  const canonical = canonicalStatus(status);

  if (!canonical) {
    return {
      status: null,
      group: null,
      // Never the raw code of a status this copy does not know: it would mean nothing to a customer.
      title: 'Mise à jour en cours',
      message: 'Nous n’avons pas pu lire l’état de votre demande. La page réessaiera dans un instant.',
      tone: 'waiting',
    };
  }

  return { status: canonical, group: statusGroupOf(canonical), ...WORDS[canonical] };
}

// ----------------------------------------------------------
// How far the job is
// ----------------------------------------------------------

export const TRACKING_STEPS = ['Demande reçue', 'Technicien désigné', 'En route', 'Intervention', 'Terminée'] as const;

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
  label: (typeof TRACKING_STEPS)[number];
  state: 'done' | 'current' | 'todo';
}

/** The five steps with where the job stands; `halted` is set (and no step is current) for a cancelled or disputed job. */
export function trackingProgress(status: string | null | undefined): { steps: TrackingStep[]; halted: 'cancelled' | 'disputed' | null } {
  const canonical = canonicalStatus(status);
  const at = canonical ? STEP_OF[canonical] : null;

  const steps = TRACKING_STEPS.map<TrackingStep>((label, index) => ({
    label,
    // The last step is a result, not something in progress: a finished job has them all done.
    state: at === null ? 'todo' : index < at || (at === TRACKING_STEPS.length - 1 && index === at) ? 'done' : index === at ? 'current' : 'todo',
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
export function statusChangeNotice(before: string | null | undefined, after: string | null | undefined): string | null {
  const previous = canonicalStatus(before) ?? before ?? null;
  const next = canonicalStatus(after) ?? after ?? null;

  if (previous === next || !after) return null;

  return `Mise à jour : ${visitorStatus(after).title}.`;
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
