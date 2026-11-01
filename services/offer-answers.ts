import type { MyOffer } from '../lib/shared';

/**
 * What the technician has just answered on this phone (P3-07), so that another screen does not go on showing an offer as open until its own next
 * read: a technician who refuses an offer on the offer screen and goes back to Home must not see the same card with a live Accept button.
 *
 * Only the time of the answer is kept, in memory (like `road-state`). A list read that was sent after the answer already carries it, and from then on
 * the server's word is the one that counts. A screen that shows offers subscribes (`useSyncExternalStore`), so that it draws again when an answer is
 * made, whatever else it is doing.
 */

const answered = new Map<number, number>();
const listeners = new Set<() => void>();
let version = 0;

const changed = () => {
  version += 1;
  listeners.forEach((listener) => listener());
};

/** The technician accepted, refused, or was told the job is gone. */
export function noteOfferAnswered(interventionId: number | string, at: number = Date.now()): void {
  const id = Number(interventionId);

  if (!Number.isInteger(id) || id <= 0) return;

  answered.set(id, at);
  changed();
}

/** True when the offer was answered after the list that shows it was asked for: that list is older than the answer. `readAt` is when it was asked for. */
export function answeredSince(interventionId: number, readAt: number | null): boolean {
  const at = answered.get(interventionId);

  return at !== undefined && (readAt === null || at >= readAt);
}

/** The offers without the open ones the technician answered after the list was asked for. `version` (from `offerAnswersVersion`) only makes a result depend on the answers made. */
export function withoutAnswered(offers: readonly MyOffer[], readAt: number | null, version: number): MyOffer[] {
  return version < 0 ? [] : offers.filter((offer) => !(offer.state === 'open' && answeredSince(offer.interventionId, readAt)));
}

export function subscribeOfferAnswers(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** Changes each time an answer is noted: the snapshot of the store. */
export function offerAnswersVersion(): number {
  return version;
}

/** For the tests of a run that must start clean. */
export function forgetOfferAnswers(): void {
  answered.clear();
  changed();
}
