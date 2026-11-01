import { canonicalStatus, routes, type RouteSpec } from '../lib/shared';

/**
 * The position of the technician, sent now and then while they are online and the app is open (P3-05).
 *
 * Why: the dispatcher flags a technician whose position has been silent for a while, and the customer is told when the technician will be
 * there only from a position that is recent. Before this, the phone sent its position when the technician went online or pressed the button.
 *
 * What it does not do: it does not run when the app is closed or in the background (the phone does not let a plain app read the GPS then; that
 * needs the "always" permission and a new build of the app, and is a decision of the owner). A technician with the app closed is shown as silent
 * after the limit, which is true.
 *
 * It never asks the person for the permission (the switch does, once): with no permission it stops and says so. It never overlaps itself: the
 * next try is planned when the previous one is over, and a start that comes while a try of the run before is still going waits for it. A
 * reading of the GPS that never comes back is given up after `READ_LIMIT_MS`, and the next try waits for that same reading instead of asking the
 * phone again (a GPS that never answers is not asked a dozen times). A 401 is a failure like another: the interceptor of the app already tried to
 * refresh the session, and a session that is really over takes the person to the login screen, which ends this screen and with it the beat.
 * It is plain TypeScript with its clock and timers given, so that it is tested without a phone.
 */

/** About this often. The server keeps one row of history per ten seconds at most, and calls a position stale after ten minutes by default. */
export const BEAT_INTERVAL_MS = 30_000;

/** A position sent this recently by another way (the switch, the refresh button) is not asked for again at once. */
export const BEAT_RECENT_MS = 10_000;

/** A reading of the GPS that has not come back after this long is given up (some phones never answer when they have no fix). */
export const READ_LIMIT_MS = 20_000;

/** A request to the phone that has not answered after this long is forgotten, and the next try asks again (until then the next tries wait for it). */
export const READ_REUSE_MS = 120_000;

/**
 * A reading that comes back after its try gave up (a slow first fix) is kept for the next try, if it is still news by then: otherwise a phone
 * whose fix always takes 21 to 49 seconds would never send anything, with a GPS that works.
 */
export const LATE_KEEP_MS = 45_000;

/** After this many tries in a row that sent nothing, the screen stops saying that the position is shared. */
export const BEAT_FAILING_AFTER = 2;

/** What the phone's GPS says. The phone writes -1, null or NaN for "no value"; the body keeps only real values. */
export interface Reading {
  latitude: number;
  longitude: number;
  /** Radius of doubt, in metres. */
  accuracy?: number | null;
  /** Metres per second. */
  speed?: number | null;
  /** Degrees from north. */
  heading?: number | null;
}

/**
 * `denied`: the person refused the location; `ask`: the permission was never decided (or the phone forgot it) and can still be asked;
 * `unavailable`: the GPS gave nothing; `failed`: the call did not go through (a refused session included).
 */
export type BeatOutcome = 'sent' | 'denied' | 'ask' | 'unavailable' | 'failed';

/** What the screen says about the position that goes out by itself. */
export type SharingState = 'on' | 'denied' | 'ask' | 'failing';

/** The words to use after a try: sharing while it goes through, "failing" once it has not for a few tries in a row. */
export function sharingStateOf(outcome: BeatOutcome, failures: number): SharingState {
  if (outcome === 'denied') return 'denied';
  if (outcome === 'ask') return 'ask';
  if (outcome === 'sent') return 'on';

  return failures >= BEAT_FAILING_AFTER ? 'failing' : 'on';
}

/** The stages of a job in which the position is part of its route, and is sent whatever the switch says. */
const ROUTE_STAGES = ['ARTISAN_ON_THE_WAY', 'ARTISAN_ARRIVED', 'IN_PROGRESS'];

/** True when one of the missions is on the way, arrived or at work: a technician who switched off to stop new requests is still on a job. */
export function jobUnderWay(missions: ReadonlyArray<{ status?: string | null }> | null | undefined): boolean {
  return (missions ?? []).some((mission) => ROUTE_STAGES.includes(canonicalStatus(mission.status) ?? ''));
}

function real(value: number | null | undefined, max: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : undefined;
}

/** The body of the position call: the place, and what the phone said about the reading when it is a real number. */
export function positionBody(reading: Reading): { latitude: number; longitude: number; accuracy?: number; speed?: number; heading?: number } {
  const accuracy = real(reading.accuracy, 100_000);
  const rawSpeed = real(reading.speed, 200);
  const rawHeading = real(reading.heading, 360);
  // Android says 0 for a speed and a heading it does not know: a speed of 0 with a heading of 0 is a reading with no motion in it, not a
  // technician standing still facing north, and it is not replayed as one. A phone that stands still has no direction either.
  const noMotion = rawSpeed === 0 && rawHeading === 0;
  const speed = noMotion ? undefined : rawSpeed;
  const heading = rawSpeed === 0 ? undefined : rawHeading;

  return {
    latitude: reading.latitude,
    longitude: reading.longitude,
    ...(accuracy !== undefined ? { accuracy } : {}),
    ...(speed !== undefined ? { speed } : {}),
    ...(heading !== undefined ? { heading } : {}),
  };
}

export interface BeatDeps {
  call: <Response>(route: RouteSpec<Response>) => Promise<Response>;
  /**
   * The position of the phone, read without asking the person anything: 'denied' when the person refused, 'ask' when the permission is not
   * granted but can still be asked, null when there is none to be had.
   */
  readPosition: () => Promise<Reading | 'denied' | 'ask' | null>;
  now: () => number;
  setTimer: (run: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  /** Told after each try, with how many tries in a row have sent nothing, so that the screen can say that the position is no longer sent. */
  onOutcome?: (outcome: BeatOutcome, failures: number) => void;
}

const TIMED_OUT = Symbol('timed out');

/** The answer of `work`, or `TIMED_OUT` when it has not come after `ms` (when the timers are given). */
function within<T>(deps: Partial<Pick<BeatDeps, 'setTimer' | 'clearTimer'>>, work: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  const { setTimer, clearTimer } = deps;

  if (!setTimer || !clearTimer) return work;

  return new Promise((resolve, reject) => {
    const handle = setTimer(() => resolve(TIMED_OUT), ms);

    work.then(
      (value) => {
        clearTimer(handle);
        resolve(value);
      },
      (error) => {
        clearTimer(handle);
        reject(error);
      },
    );
  });
}

/**
 * One try: read the position and send it. Never throws. `stillWanted` is asked once the reading is in hand and before it is sent: a try
 * that was stopped while the phone was reading (a sign-out, the app going to the background) sends nothing.
 */
export async function sendBeat(
  deps: Pick<BeatDeps, 'call' | 'readPosition'> & Partial<Pick<BeatDeps, 'setTimer' | 'clearTimer'>>,
  stillWanted: () => boolean = () => true,
): Promise<BeatOutcome> {
  try {
    const reading = await within(deps, deps.readPosition(), READ_LIMIT_MS);

    if (reading === TIMED_OUT) return 'unavailable';
    if (reading === 'denied') return 'denied';
    if (reading === 'ask') return 'ask';
    if (!reading) return 'unavailable';
    if (!stillWanted()) return 'unavailable';

    await deps.call(routes.artisans.location(positionBody(reading)));

    return 'sent';
  } catch {
    return 'failed';
  }
}

export interface Beat {
  /** Starts sending (at once, unless a position went out a moment ago). Does nothing if it is already going. */
  start: () => void;
  /** Stops for good until `start` is called again. A try that is under way ends without planning another. */
  stop: () => void;
  /** Tells it that a position was just sent by another way, so that it does not ask the GPS again at once. */
  noteSent: () => void;
  isRunning: () => boolean;
}

export function createBeat(deps: BeatDeps): Beat {
  let running = false;
  // Counts the starts and stops: a try that began before the last stop or start does not plan the next one.
  let generation = 0;
  let timer: unknown = null;
  let lastSentAt: number | null = null;
  // True while a try is under way, of whichever run: a start that comes during it waits, so that two readings never race and an older one never lands after a newer one.
  let trying = false;
  let failures = 0;
  // The reading of the GPS that is still waiting for an answer. The limit abandons the wait, not the request made to the phone: the next try
  // waits for the same reading instead of starting another, so that a GPS that is slow has one request pending, not a new one every thirty
  // seconds. A request that has not answered after `READ_REUSE_MS` is given up for good and the next try asks again: a request the phone lost
  // must not silence the beat for the rest of the session.
  let pendingRead: ReturnType<BeatDeps['readPosition']> | null = null;
  let pendingSince = 0;
  // A reading that came back while no try was waiting for it (its try gave up): kept for the next try while it is still news.
  let lateReading: { reading: Reading; at: number } | null = null;

  const readOnce: BeatDeps['readPosition'] = () => {
    // A clock set back makes the age negative: the request is forgotten then too, or it would be reused for ever.
    const age = deps.now() - pendingSince;

    if (pendingRead === null || age >= READ_REUSE_MS || age < 0) {
      const started = deps.readPosition();
      const settled = (value: Reading | 'denied' | 'ask' | null | undefined) => {
        const current = pendingRead === started;

        if (current) pendingRead = null;
        if (current && running && !trying && value && typeof value === 'object') lateReading = { reading: value, at: deps.now() };
      };

      pendingRead = started;
      pendingSince = deps.now();
      started.then(settled, () => settled(null));
    }

    return pendingRead;
  };

  /** The late reading, if there is one and it is still news (and it is used once). */
  const takeLate = (): Reading | null => {
    const late = lateReading;

    lateReading = null;

    if (!late) return null;

    const age = deps.now() - late.at;

    return age >= 0 && age <= LATE_KEEP_MS ? late.reading : null;
  };

  const cancelTimer = () => {
    if (timer !== null) deps.clearTimer(timer);

    timer = null;
  };

  const plan = (ms: number, mine: number) => {
    cancelTimer();
    timer = deps.setTimer(() => {
      timer = null;
      void tick(mine);
    }, Math.max(0, ms));
  };

  /** How long to wait before the next reading because a position went out a moment ago (0 when none did, or the clock was set back). */
  const waitAfterRecent = (): number => {
    if (lastSentAt === null) return 0;

    const since = deps.now() - lastSentAt;

    return since >= 0 && since < BEAT_RECENT_MS ? BEAT_INTERVAL_MS - since : 0;
  };

  const tick = async (mine: number): Promise<void> => {
    if (!running || mine !== generation) return;

    if (trying) {
      plan(1_000, mine);

      return;
    }

    // The button or the switch sent a position since this try was planned: this one waits for the end of the interval counted from that one.
    const wait = waitAfterRecent();

    if (wait > 0) {
      plan(wait, mine);

      return;
    }

    trying = true;

    let outcome: BeatOutcome;
    const late = takeLate();

    try {
      outcome = await sendBeat({ ...deps, readPosition: late ? () => Promise.resolve(late) : readOnce }, () => running && mine === generation);
    } finally {
      trying = false;
    }

    // A position that went out counts whichever run sent it; a failure counts only for the run that is still going.
    if (outcome === 'sent') {
      lastSentAt = deps.now();
      lateReading = null;
    }

    // Whatever happened, the screen is told, unless this run was stopped meanwhile.
    if (mine !== generation) return;

    failures = outcome === 'sent' ? 0 : failures + 1;

    deps.onOutcome?.(outcome, failures);

    // No permission: nothing will change by trying again every thirty seconds. The next start tries once more.
    if (outcome === 'denied' || outcome === 'ask') {
      running = false;
      cancelTimer();

      return;
    }

    if (running) plan(BEAT_INTERVAL_MS, mine);
  };

  return {
    start() {
      if (running) return;

      running = true;
      generation += 1;
      failures = 0;

      // A position went out a moment ago: the first try waits for the end of the interval, counted from that one.
      plan(waitAfterRecent(), generation);
    },
    stop() {
      running = false;
      generation += 1;
      lateReading = null;
      cancelTimer();
    },
    noteSent() {
      lastSentAt = deps.now();
      lateReading = null;
      failures = 0;
    },
    isRunning: () => running,
  };
}
