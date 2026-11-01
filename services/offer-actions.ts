import { apiErrorMessage, message, offerIsGone, routes, type Locale, type MissionRejectionReason, type RouteSpec } from '../lib/shared';
import { declineBody } from './mission-steps';

/**
 * What the technician does with an offer (P3-07): accept it, or refuse it. Both go straight to the server and are never kept for later: an accept needs
 * the server's answer on the spot (another technician may have taken the job a second ago), and a refusal tells the team to look elsewhere now.
 * Plain TypeScript with the call given, so that it is tested without a phone.
 */

export type CallRoute = <Response>(route: RouteSpec<Response>) => Promise<Response>;

/**
 * `accepted`: the job is the technician's. `gone`: the server says the job is no longer there for them (taken by another, withdrawn, not theirs,
 * gone: 409, 403 or 404); the sentence is the server's own, and the screen reads the offers again to say how it ended. `failed`: nothing is known (no
 * network, a server in trouble): the offer may still be good, the technician can press again, and a second accept of the same job is answered like the first.
 */
export type OfferAnswer = { kind: 'accepted' } | { kind: 'gone'; message: string } | { kind: 'failed'; message: string };

export type RefusalAnswer = { kind: 'refused' } | { kind: 'gone'; message: string } | { kind: 'failed'; message: string };

export async function acceptOffer(call: CallRoute, interventionId: number | string, locale: Locale): Promise<OfferAnswer> {
  try {
    await call(routes.artisans.accept(interventionId));

    return { kind: 'accepted' };
  } catch (error) {
    // A job that is gone is told as gone even when the server gave no sentence: "try again" would be wrong.
    return offerIsGone(error)
      ? { kind: 'gone', message: apiErrorMessage(error, message(locale, 'app.offers.outcome.closed')) }
      : { kind: 'failed', message: apiErrorMessage(error, message(locale, 'app.offers.acceptFailed')) };
  }
}

export async function refuseOffer(
  call: CallRoute,
  interventionId: number | string,
  reason: MissionRejectionReason,
  note: string,
  locale: Locale,
): Promise<RefusalAnswer> {
  try {
    await call(routes.artisans.decline(interventionId, declineBody(reason, note)));

    return { kind: 'refused' };
  } catch (error) {
    return offerIsGone(error)
      ? { kind: 'gone', message: apiErrorMessage(error, message(locale, 'app.offers.outcome.closed')) }
      : { kind: 'failed', message: apiErrorMessage(error, message(locale, 'app.offers.refuseFailed')) };
  }
}
