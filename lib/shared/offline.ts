import { apiErrorStatus } from './errors';
import { missionBucketOf, MISSION_FLOW, type MissionStep } from './mission-flow';
import { canonicalStatus } from './generated/intervention-status';

/**
 * Actions the phone keeps until it has a signal (P3-06): the rules that the phone app and its tests share.
 *
 * What is kept: the three steps of the road (on the way, arrived, start) and the photo that closes the job. What is not: accepting a job and
 * giving it back, which need the server's answer on the spot (another technician may have taken the job, the dispatcher must look for another
 * one now). The phone keeps what it holds on the device, sends it in order when it can, and says for each call how long it held it (the header
 * `X-Queued-For`, in seconds), so that the server dates the action when it was done and does not take the photo for one whose phone has the wrong
 * clock.
 */

/** The header the phone adds to an action it held, with the seconds it held it (src/common/time/queued-for.ts on the server). */
export const QUEUED_FOR_HEADER = 'X-Queued-For';

/** The most seconds the server counts: the phone gives up on an action it could not send in that time, and never says more. */
export const MAX_QUEUED_FOR_SECONDS = 7 * 24 * 3600;

/** The actions the phone may keep. */
export type QueuedStep = Extract<MissionStep, 'on-the-way' | 'arrived' | 'start' | 'complete'>;

export const QUEUED_STEPS: readonly QueuedStep[] = ['on-the-way', 'arrived', 'start', 'complete'];

/** True for an action the phone may keep (not accept, not give back). */
export function isQueuedStep(step: string | null | undefined): step is QueuedStep {
  return (QUEUED_STEPS as readonly string[]).includes(step ?? '');
}

/** How long an action was held, in whole seconds: 0 for a clock that went back, and never more than the server counts. */
export function heldSeconds(madeAt: number, now: number): number {
  if (!Number.isFinite(madeAt) || !Number.isFinite(now)) return 0;

  return Math.min(MAX_QUEUED_FOR_SECONDS, Math.max(0, Math.floor((now - madeAt) / 1000)));
}

/** True when an action is older than the server counts: it is dropped, and the technician is told. */
export function isTooOld(madeAt: number, now: number): boolean {
  return Number.isFinite(madeAt) && Number.isFinite(now) && now - madeAt > MAX_QUEUED_FOR_SECONDS * 1000;
}

/** The headers of a call that was held: none when it was not (a call sent at once is a call like any other). */
export function heldHeaders(seconds: number): Record<string, string> | undefined {
  return Number.isInteger(seconds) && seconds > 0 ? { [QUEUED_FOR_HEADER]: String(Math.min(seconds, MAX_QUEUED_FOR_SECONDS)) } : undefined;
}

/**
 * What to do with a call that failed:
 *  - `retry`: the server was not reached or is not well (no answer, a timeout, a 5xx, "too many requests", a session that could not be renewed);
 *    the action stays kept and goes again later. A 401 is one of these: the app already tried to renew the session, and if it is over the person
 *    is taken to the login screen, where the kept action waits for them.
 *  - `conflict`: the server answered 409, "the job is not in a state that takes this": for a step the job has moved on (cancelled, taken back),
 *    for a closing photo it may be that this very photo already closed the job (the answer was lost) and the phone must look.
 *  - `refused`: any other answer of the server (400 a photo it will not take, 403 and 404 a job that is no longer theirs): it will not change by
 *    asking again; the action is dropped and the technician is told why.
 */
export type FailureKind = 'retry' | 'conflict' | 'refused';

const RETRY_STATUSES = new Set([401, 408, 425, 429]);

export function failureKind(error: unknown): FailureKind {
  const status = apiErrorStatus(error);

  if (status === null) return 'retry';
  if (status === 409) return 'conflict';
  if (status >= 500 || RETRY_STATUSES.has(status)) return 'retry';

  return 'refused';
}

/** The order of the road, as far as a phone can walk it alone. */
const ROAD = ['ASSIGNED', 'ARTISAN_ACCEPTED', 'ARTISAN_ON_THE_WAY', 'ARTISAN_ARRIVED', 'IN_PROGRESS', 'COMPLETED'] as const;

function placeOnRoad(status: string | null): number {
  if (!status) return -1;

  const index = (ROAD as readonly string[]).indexOf(status);

  if (index >= 0) return index;

  // After the end of the road (waiting for the customer, paid, invoiced): beyond every step.
  return missionBucketOf(status) === 'done' ? ROAD.length : -1;
}

/**
 * True when the server's own status shows that this step is already done: the job is at the place the step leads to, or further on the road, or
 * over. Used when a held action is answered "409, not in a state that takes this": if the answer of an earlier try was lost, the server has the
 * action and the phone must not call it a failure. A job that is cancelled, handed back or unknown to the phone is never "done" by this.
 */
export function serverHasStep(status: string | null | undefined, step: QueuedStep): boolean {
  const info = MISSION_FLOW.find((entry) => entry.step === step);
  const current = canonicalStatus(status) ?? null;

  if (!info || current === null) return false;

  const place = placeOnRoad(current);

  return place >= 0 && place >= placeOnRoad(info.to);
}

export interface StatusWithPending {
  /** The status to show and to take the next step from: the server's, moved on by the actions the phone still holds. */
  readonly status: string | null;
  /** How many of the held actions are counted in it. */
  readonly shown: number;
}

/**
 * The status of a job once the actions the phone still holds are counted, so that a technician without a signal sees "on the way" after pressing
 * it, and is offered "arrived" next. The held actions are walked in order: one that fits the status takes it on, one already behind it (the server
 * has it: the answer was lost) is passed over, and the walk stops at one that does not fit (a job that is cancelled, handed back, not the technician's
 * any more): from there the server's word is shown.
 *
 * Give it the held steps of the road (on the way, arrived, start). The photo that closes the job is walked like any step if it is given, but a screen
 * must not count it: a job is over when the server has the photo and has accepted it (it may go to a review), not when the phone holds it.
 */
export function statusWithPending(status: string | null | undefined, held: ReadonlyArray<QueuedStep>): StatusWithPending {
  let current = canonicalStatus(status) ?? null;
  let shown = 0;
  let moved = false;

  for (const step of held) {
    const info = MISSION_FLOW.find((entry) => entry.step === step);

    if (!info || current === null) break;

    const place = placeOnRoad(current);

    if (current === info.from) {
      current = info.to;
      shown += 1;
      moved = true;
    } else if (place >= placeOnRoad(info.to) && place >= 0) {
      // The server already has it.
      shown += 1;
    } else {
      break;
    }
  }

  // The server's own word when nothing moved it (its spelling of the status is not changed for nothing).
  return { status: moved ? current : (status ?? null), shown };
}
