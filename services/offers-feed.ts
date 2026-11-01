import { OFFER_POLL_MS, apiErrorStatus, clockOffset, pollDelay, slimOffers, type MyOffer } from '../lib/shared';

/** A round trip longer than this says little about the two clocks (a slow link, a sign-in renewed on the way): the offset already known is kept. */
export const MAX_TRIP_FOR_OFFSET_MS = 5_000;

/**
 * The offers made to the technician, read from the server and kept up to date while a screen shows them (P3-07).
 *
 * The phone has no live connection to the server, so this is how a withdrawal reaches it: while the screen is in front, the list is read again every
 * fifteen seconds when an offer is open (and every minute otherwise, a new offer also arrives as a push). Between two reads the countdown runs on the
 * phone's clock corrected by the difference between the server's clock and the phone's at the moment the answer arrived (the middle of the trip),
 * so that a phone whose clock is wrong shows the right time left.
 *
 * It keeps what it last read when a read fails (a technician in a lift keeps the offer on screen; the server judges the accept anyway), and says that the
 * read failed. The newest answer wins: an older one that comes back later is dropped, and so is any answer that comes after `stop`. It never overlaps
 * its timer with itself: one timer at a time, planned when an answer arrives. Plain TypeScript with its clock and timers given, so that it is tested
 * without a phone.
 */

export interface OffersState {
  offers: MyOffer[];
  /** The server's clock minus the phone's, in milliseconds; null while no answer has been read. */
  offset: number | null;
  /** The phone's clock when the request of the last answer applied was sent; null while no answer has been read. */
  readAt: number | null;
  /** An answer has been read since this screen opened. */
  loaded: boolean;
  /** The last read failed (the offers shown are the ones read before, if any). */
  failed: boolean;
}

export const EMPTY_OFFERS: OffersState = { offers: [], offset: null, readAt: null, loaded: false, failed: false };

export interface OffersFeedDeps {
  /** Reads `GET /artisans/me/offers`. */
  load: () => Promise<unknown>;
  now: () => number;
  setTimer: (run: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  onChange: (state: OffersState) => void;
}

export interface OffersFeed {
  /** Reads now, and keeps reading while it runs. */
  start(): void;
  /** Stops reading; an answer still on its way is dropped. */
  stop(): void;
  /** Reads once now (after an accept, a refusal or a refusal of the server), whether it runs or not. Answers the state once the read is done. */
  refresh(): Promise<OffersState>;
  state(): OffersState;
}

export function createOffersFeed(deps: OffersFeedDeps): OffersFeed {
  let state: OffersState = EMPTY_OFFERS;
  let running = false;
  // Counts the starts and stops: an answer asked for in an earlier run is not for this one.
  let run = 0;
  let asked = 0;
  let applied = 0;
  let timer: unknown = null;

  const publish = (next: OffersState) => {
    state = next;
    deps.onChange(state);
  };

  const unplan = () => {
    if (timer !== null) deps.clearTimer(timer);

    timer = null;
  };

  const plan = () => {
    unplan();

    if (!running) return;

    // Before any answer has been read the screen has nothing to show: it asks again quickly, not at the pace of an empty list.
    const wait = state.loaded ? pollDelay(state.offers, deps.now(), state.offset) : OFFER_POLL_MS;

    timer = deps.setTimer(() => {
      timer = null;
      void refresh();
    }, wait);
  };

  async function refresh(): Promise<OffersState> {
    const mine = (asked += 1);
    const myRun = run;
    const sentAt = deps.now();

    try {
      const raw = await deps.load();
      const arrivedAt = deps.now();
      const read = slimOffers(raw);

      if (myRun !== run || mine < applied) return state;

      if (!read) throw new Error('unreadable answer');

      applied = mine;

      // The server wrote its time somewhere between the sending and the arrival: the middle is the best guess. After a long trip the guess is
      // poor, so an offset already known is kept.
      const measured = clockOffset(read.now, Math.round((sentAt + arrivedAt) / 2));
      const offset = arrivedAt - sentAt > MAX_TRIP_FOR_OFFSET_MS && state.offset !== null ? state.offset : measured;

      publish({ offers: read.offers, offset, readAt: sentAt, loaded: true, failed: false });
    } catch (error) {
      if (myRun !== run || mine < applied) return state;

      applied = mine;

      // A technician whose profile is not approved is refused (403): they have no offers, which is an answer and not a failure (the home screen
      // already tells them their profile is under review).
      if (apiErrorStatus(error) === 403) publish({ offers: [], offset: state.offset, readAt: sentAt, loaded: true, failed: false });
      else publish({ ...state, failed: true });
    } finally {
      // Planned again from here, whatever happened: a failed read is tried again at the pace of the list.
      if (running && myRun === run) plan();
    }

    return state;
  }

  return {
    start() {
      if (running) {
        void refresh();

        return;
      }

      running = true;
      run += 1;
      void refresh();
    },
    stop() {
      running = false;
      run += 1;
      unplan();
    },
    refresh,
    state: () => state,
  };
}
