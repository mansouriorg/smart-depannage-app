import type { QueueProblem } from './offline-queue';

/**
 * Reading a new problem out to a screen reader (P3-06), for the banner of the screen that is in front. The rules are here, apart from the screen,
 * so that they can be run with a fake clock:
 *
 * - nothing is read before the queue has read its file (what was there before is not new), and the first look at the screen reads nothing;
 * - only a problem that was not known at the previous run is new; only the newest of the new ones is read, and only by a screen in front;
 * - it is read after a delay, and only if it is still there then (a screen that tells a refusal itself dismisses it at once);
 * - a run that cancels an announcement that has not been made yet (other problems arrived, the language changed) gives the problems back as they
 *   were known before it: the next run finds the same problem new again. Otherwise the problem would count as known and never be read.
 *
 * `run` is the body of the screen's effect, `state` lives as long as the screen; it gives back what the effect gives back (its clean-up).
 */
export interface AnnounceState {
  /** The ids of the problems known at the last run; null before the first run that counts. */
  known: Set<string> | null;
}

export interface AnnounceEnv {
  /** The queue has read its file. */
  ready: boolean;
  isFocused: () => boolean;
  /** The problems as they are when the delay is over. */
  latest: () => readonly QueueProblem[];
  speak: (problem: QueueProblem) => void;
  setTimer: (run: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  delayMs: number;
}

export function announceNewProblems(state: AnnounceState, problems: readonly QueueProblem[], env: AnnounceEnv): (() => void) | undefined {
  if (!env.ready) return undefined;

  const known = state.known;

  state.known = new Set(problems.map((problem) => problem.id));

  if (known === null) return undefined;

  const fresh = problems.filter((problem) => !known.has(problem.id));
  const last = fresh[fresh.length - 1];

  if (!last || !env.isFocused()) return undefined;

  let made = false;

  const timer = env.setTimer(() => {
    made = true;

    if (env.isFocused() && env.latest().some((problem) => problem.id === last.id)) env.speak(last);
  }, env.delayMs);

  return () => {
    env.clearTimer(timer);

    if (!made) state.known = known;
  };
}
