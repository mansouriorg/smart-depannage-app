import type { StatusTone } from './status';

/**
 * The moderation queue of the reviews customers write (P2-09): the words, what the server answers, and the check of the reason a
 * moderator gives. The server side is `smart-depannage-serveur` (src/modules/reviews/review-queue.ts). Written by hand, like `finance.ts`.
 *
 * A review is PENDING until a moderator decides. APPROVED reviews are shown, and counted in the rating of the technician. REJECTED
 * and HIDDEN reviews are shown to nobody; the moderator says why, and the reason is kept.
 */

export const REVIEW_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'HIDDEN'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  PENDING: 'À modérer',
  APPROVED: 'Publié',
  REJECTED: 'Refusé',
  HIDDEN: 'Masqué',
};

const REVIEW_TONES: Record<ReviewStatus, StatusTone> = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger', HIDDEN: 'waiting' };

export const reviewStatusLabel = (status: string | null | undefined): string => REVIEW_STATUS_LABELS[status as ReviewStatus] ?? String(status ?? '');
export const reviewTone = (status: string | null | undefined): StatusTone => REVIEW_TONES[status as ReviewStatus] ?? 'waiting';
export const isReviewStatus = (value: unknown): value is ReviewStatus => (REVIEW_STATUSES as readonly string[]).includes(String(value));

export const REVIEW_SORTS = ['oldest', 'newest'] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];

export const REVIEW_SORT_LABELS: Record<ReviewSort, string> = {
  oldest: 'Les plus anciens d’abord',
  newest: 'Les plus récents d’abord',
};

/** The rating filter: "1 étoile", "2 étoiles ou moins", … */
export const REVIEW_RATING_CHOICES = [1, 2, 3, 4, 5] as const;

export function ratingFilterLabel(best: number): string {
  if (best >= 5) return 'Toutes les notes';

  return best === 1 ? '1 étoile' : `${best} étoiles ou moins`;
}

/** "★★★☆☆" for 3. */
export function starsText(rating: number | null | undefined): string {
  const count = Math.min(Math.max(Math.round(Number(rating) || 0), 0), 5);

  return '★'.repeat(count) + '☆'.repeat(5 - count);
}

export interface ReviewPerson {
  id: number;
  name: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface ReviewRow {
  id: number;
  interventionId: number;
  clientId: number;
  artisanId: number | null;
  rating: number;
  comment: string | null;
  isOnTime: boolean | null;
  isWorkClean: boolean | null;
  isPriceRespected: boolean | null;
  wouldRecommend: boolean | null;
  status: string;
  isVisible: boolean;
  moderatedById: number | null;
  moderatedAt: string | null;
  moderationReason: string | null;
  createdAt: string;
  client: ReviewPerson | null;
  artisan: (ReviewPerson & { artisanProfile?: { averageRating?: number | string | null; ratingCount?: number | null } | null }) | null;
  intervention?: { id: number; description?: string | null; serviceType?: string | null } | null;
}

export type ReviewCounts = Record<ReviewStatus | 'all', number>;

/** A page of the queue: paged by `skip` and `take`, with how many each tab holds under the same search and filters. */
export interface ReviewPage {
  total: number;
  skip: number;
  take: number;
  items: ReviewRow[];
  counts: ReviewCounts;
}

export interface ReviewQuery {
  skip?: number;
  take?: number;
  status?: ReviewStatus;
  search?: string;
  /** The best rating shown: 2 asks for the 1- and 2-star reviews. */
  maxRating?: number;
  sort?: ReviewSort;
  artisanId?: number | string;
}

/** The parameters of a queue query without the ones left empty; 5 stars or less is every review, so no filter is sent for it. */
export function reviewParams(query: ReviewQuery): Record<string, string | number> {
  const out: Record<string, string | number> = {};

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;

    if (key === 'maxRating' && Number(value) >= 5) continue;

    if (typeof value === 'string') {
      const text = value.trim();

      if (text !== '') out[key] = text;
    } else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
  }

  return out;
}

// ----------------------------------------------------------
// The decision
// ----------------------------------------------------------

export type ReviewAction = 'approve' | 'reject' | 'hide';

export const REVIEW_ACTION_LABELS: Record<ReviewAction, string> = {
  approve: 'Publier',
  reject: 'Refuser',
  hide: 'Masquer',
};

export const REVIEW_ACTION_STATUS: Record<ReviewAction, ReviewStatus> = { approve: 'APPROVED', reject: 'REJECTED', hide: 'HIDDEN' };

/**
 * What a moderator can do with a review in this status. A waiting review is published or refused; a published one is hidden (or
 * refused); a refused or hidden one can be looked at again and published.
 */
export function reviewActions(status: string | null | undefined): ReviewAction[] {
  switch (status) {
    case 'PENDING':
      return ['approve', 'reject'];
    case 'APPROVED':
      return ['hide', 'reject'];
    case 'REJECTED':
    case 'HIDDEN':
      return ['approve'];
    default:
      return [];
  }
}

/** The longest reason a moderator can give, and the shortest. */
export const MODERATION_REASON_MAX = 500;
export const MODERATION_REASON_MIN = 3;

export type ModerationRead = { ok: true; body: { status: ReviewStatus; moderationReason?: string } } | { ok: false; message: string };

/**
 * The body of a decision. Refusing or hiding a review needs a reason (3 to 500 characters), so that the decision can be explained
 * later; publishing needs none and sends none (a reason typed and then not needed is not kept).
 */
export function readModeration(action: ReviewAction, reason: unknown): ModerationRead {
  const status = REVIEW_ACTION_STATUS[action];

  if (!status) return { ok: false, message: 'Choisissez une décision.' };
  if (action === 'approve') return { ok: true, body: { status } };

  const text = typeof reason === 'string' ? reason.replace(/\u0000/g, '').trim() : '';

  if (text === '') return { ok: false, message: 'Indiquez pourquoi cet avis est refusé ou masqué.' };
  if (text.length < MODERATION_REASON_MIN) return { ok: false, message: `La raison est trop courte : au moins ${MODERATION_REASON_MIN} caractères.` };
  if (text.length > MODERATION_REASON_MAX) return { ok: false, message: `La raison ne peut pas dépasser ${MODERATION_REASON_MAX} caractères.` };

  return { ok: true, body: { status, moderationReason: text } };
}

/** What the page says about the criteria of a review: "À l’heure · Propre · Prix respecté · Recommande". */
export function reviewCriteriaWords(row: Pick<ReviewRow, 'isOnTime' | 'isWorkClean' | 'isPriceRespected' | 'wouldRecommend'>): string {
  const parts: string[] = [];
  const add = (value: boolean | null, yes: string, no: string) => {
    if (value === true) parts.push(yes);
    else if (value === false) parts.push(no);
  };

  add(row.isOnTime, 'À l’heure', 'En retard');
  add(row.isWorkClean, 'Travail propre', 'Travail pas propre');
  add(row.isPriceRespected, 'Prix respecté', 'Prix non respecté');
  add(row.wouldRecommend, 'Recommande', 'Ne recommande pas');

  return parts.join(' · ');
}
