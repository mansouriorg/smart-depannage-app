import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { apiErrorBody, apiErrorMessage, heldHeaders, message, routes } from '../lib/shared';
import api, { UPLOAD_TIMEOUT_MS, onSessionChange, readTokenOrThrow } from './api';
import { call } from './call';
import { currentLocale } from './i18n-core';
import { isOwnMission, stepFailure } from './mission-steps';
import { createOfflineQueue, userIdOfToken, type QueueSender, type QueueSnapshot } from './offline-queue';
import { fileStore } from './offline-store';
import { noteMissionLeft } from './road-state';

/**
 * The queue of actions the phone keeps until it has a signal (P3-06), wired to the phone: its file system, the server, the session and the
 * app coming back to the front. The rules are in `offline-queue.ts` (and, shared with the other apps, `lib/shared/offline.ts`).
 *
 * When it sends: at once when an action is made, when the app comes back to the front, when a screen that shows the queue comes into view (these
 * two without waiting for the planned time: a technician who walks out of a basement and opens the app should not wait for the timer), on its
 * own timer (30 s, 1 min, 2 min, then every 5 minutes) while the app is open, and when the technician presses "Envoyer maintenant". It does not
 * send when the app is closed or in the background: the phone does not let a plain app run then. There is no listener on the network state (the
 * package for it is not part of the app): the timer finds the connection again within five minutes.
 */

const sender: QueueSender = {
  step(entry, held) {
    switch (entry.step) {
      case 'on-the-way':
        return call(routes.artisans.onTheWay(entry.missionId, held));
      case 'arrived':
        return call(routes.artisans.arrived(entry.missionId, held));
      case 'start':
        return call(routes.artisans.start(entry.missionId, held));
      default:
        return Promise.reject(new Error(`NOT_A_PLAIN_STEP:${entry.step}`));
    }
  },

  async proof(entry, held) {
    const photo = entry.photo;

    if (!photo) throw new Error('NO_PHOTO');

    const formData = new FormData();

    formData.append('photo', { uri: fileStore.resolvePhoto(photo.uri), name: `proof_${entry.id}.jpg`, type: 'image/jpeg' } as unknown as Blob);
    formData.append('latitude', String(photo.latitude));
    formData.append('longitude', String(photo.longitude));
    // The server judges the photo with the precision of the GPS and the flag of a simulated position.
    if (typeof photo.accuracy === 'number') formData.append('accuracy', String(photo.accuracy));
    if (typeof photo.mocked === 'boolean') formData.append('mocked', String(photo.mocked));
    formData.append('timestamp', photo.capturedAt);

    const response = await api.post(`/interventions/${entry.missionId}/complete-work`, formData, {
      // How long the photo waited goes with it (X-Queued-For): the server dates the end of the work when it was done, and does not take a photo that
      // waited for a signal for one whose phone has the wrong clock.
      headers: { 'Content-Type': 'multipart/form-data', ...heldHeaders(held) },
      // A photo on a weak mobile connection soon takes more than 10 seconds.
      timeout: UPLOAD_TIMEOUT_MS,
    });

    // A photo that the server could not check alone is kept and looked at by the team.
    return { needsReview: response.data?.proof?.status === 'NEEDS_REVIEW' };
  },

  async status(missionId) {
    const job = await call(routes.artisans.mission(missionId));

    // The board's copy comes back for a job nobody holds: it says nothing about this technician's action.
    return isOwnMission(job) ? (job.status ?? null) : null;
  },

  describe(error, entry) {
    const locale = currentLocale();
    const fallback = entry.step === 'complete' ? message(locale, 'app.mission.proofFailed') : stepFailure(entry.step as 'on-the-way' | 'arrived' | 'start', locale);
    const code = (apiErrorBody(error) as { code?: unknown } | null)?.code;

    return { reason: apiErrorMessage(error, fallback), code: typeof code === 'string' ? code : null };
  },
};

let counter = 0;

/**
 * The user number of the session that is open on the phone (null when none): the number the server wrote inside the token. A keychain that
 * cannot be read throws (a locked phone a moment after the screen went off): the queue then keeps the user it had, it does not take it for a
 * sign-out.
 */
async function whoAmI(): Promise<string | null> {
  return userIdOfToken(await readTokenOrThrow());
}

export const offlineQueue = createOfflineQueue({
  store: fileStore,
  send: sender,
  now: () => Date.now(),
  newId: () => {
    counter += 1;

    return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  },
  setTimer: (run, ms) => setTimeout(run, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  whoAmI,
  log: (what, detail) => console.warn(`[offline] ${what}`, detail instanceof Error ? detail.message : (detail ?? '')),
});

let syncTicket = 0;

/** Tells the queue whose session is open. Never throws. Of several calls that overlap, only the last one to start is heard (it read the latest). */
export async function syncOfflineUser(): Promise<void> {
  syncTicket += 1;

  const ticket = syncTicket;

  try {
    const who = await whoAmI();

    if (ticket === syncTicket) offlineQueue.setUser(who);
  } catch {
    // The token could not be read: the queue keeps the user it had; the next change asks again.
  }
}

// The queue follows the session (a sign-in, a renewal, a sign-out), and the app coming back to the front.
onSessionChange(() => {
  void syncOfflineUser();
});

AppState.addEventListener('change', (state) => {
  if (state !== 'active') return;

  // Back in front: try now, whatever the planned time of the next try is (the phone may have been in a pocket for an hour).
  void syncOfflineUser().then(() => offlineQueue.flush({ force: true }));
});

// A closing photo that left (or that the server already had) ends the work: the home screen is told at once, whatever its list still says
// until it reads it again (the mission screen may be gone by the time the photo leaves).
offlineQueue.onEvent((event) => {
  if (event.kind !== 'dropped' && event.entry.step === 'complete') noteMissionLeft(event.entry.missionId);
});

void offlineQueue
  .start()
  .then(() => syncOfflineUser())
  .then(() => offlineQueue.flush({ force: true }));

/**
 * Tells a screen that an action left the phone (sent, already there, or refused), a moment after the last one of a burst: a list reads itself
 * again, so that it shows what the server now says. Gives back what stops it.
 */
export function onQueueSettled(callback: () => void, delayMs = 400): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const stop = offlineQueue.onEvent(() => {
    if (timer !== null) clearTimeout(timer);

    timer = setTimeout(() => {
      timer = null;
      callback();
    }, delayMs);
  });

  return () => {
    stop();

    if (timer !== null) clearTimeout(timer);

    timer = null;
  };
}

/** What the screens show: the actions that wait, the problems to read, whether a send is going. */
export function useOfflineQueue(): QueueSnapshot {
  return useSyncExternalStore(offlineQueue.subscribe, offlineQueue.getSnapshot, offlineQueue.getSnapshot);
}
