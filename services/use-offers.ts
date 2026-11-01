import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { OFFER_PUSH_TYPE, isOpenNow, pushTargetOf, routes } from '../lib/shared';
import { call } from './call';
import { offerAnswersVersion, subscribeOfferAnswers, withoutAnswered } from './offer-answers';
import { createOffersFeed, EMPTY_OFFERS, type OffersFeed, type OffersState } from './offers-feed';

/**
 * The offers made to the technician, for a screen (P3-07): they are read while `active` (the screen is in front and the app is open), kept up to date by
 * `createOffersFeed`, and the clock `now` ticks every second while an offer is open so that the countdown moves. `active` false stops everything: no
 * request, no timer.
 */
export function useOffers(active: boolean): OffersState & { now: number; refresh: () => Promise<OffersState> } {
  const [state, setState] = useState<OffersState>(EMPTY_OFFERS);
  const [now, setNow] = useState(() => Date.now());
  const feed = useRef<OffersFeed | null>(null);

  if (feed.current === null) {
    feed.current = createOffersFeed({
      load: () => call(routes.artisans.offers()),
      now: () => Date.now(),
      setTimer: (run, ms) => setTimeout(run, ms),
      clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      onChange: setState,
    });
  }

  useEffect(() => {
    if (!active) return;

    const running = feed.current;

    running?.start();

    return () => running?.stop();
  }, [active]);

  // A push about an offer that arrives while the screen is open brings the list up to date at once, instead of at the next read.
  useEffect(() => {
    if (!active) return;

    const listening = Notifications.addNotificationReceivedListener((received: Notifications.Notification) => {
      if (pushTargetOf(received.request.content.data)?.type === OFFER_PUSH_TYPE) void feed.current?.refresh();
    });

    return () => listening.remove();
  }, [active]);

  // An offer the technician answered on this phone after the list was asked for is not shown as open: that list is older than the answer. The screen
  // draws again when an answer is made (the store), whatever else it is doing.
  const answers = useSyncExternalStore(subscribeOfferAnswers, offerAnswersVersion, offerAnswersVersion);
  const offers = withoutAnswered(state.offers, state.readAt, answers);

  // `now` below is the clock of this very render (the state only makes the screen draw again each second): a countdown never starts from an old reading.
  const clock = Math.max(now, Date.now());
  const anyOpen = offers.some((offer) => isOpenNow(offer, clock, state.offset));

  useEffect(() => {
    if (!active || !anyOpen) return;

    setNow(Date.now());

    const ticking = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(ticking);
  }, [active, anyOpen]);

  return { ...state, offers, now: clock, refresh: () => feed.current?.refresh() ?? Promise.resolve(state) };
}
