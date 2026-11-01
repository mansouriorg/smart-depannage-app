import { jobUnderWay } from './position-beat';

/**
 * What the screens of the phone tell each other about the road (P3-05), in memory, for as long as the app runs.
 *
 * The position goes out by itself from the home screen while a job is on the way, arrived or at work. The home screen learns about the jobs
 * only when it is shown (and on a pull to refresh). Two things follow, and this store is how the other screens put them right:
 *
 *  - A technician who is offline is given a job, opens it from the notification and sets out on the mission screen: Home would send nothing
 *    until they went back to it. The mission screen tells here what status it holds (`noteMissionStatus`).
 *  - A technician completes a job on the mission screen, which was opened from another tab: Home's list still says the job is at work and
 *    would go on sending. What the mission screen told wins over Home's list for that job (`jobsUnderWay`), until Home reads its list again:
 *    a list that was asked for after the mission screen spoke is fresher and takes over (`reconcileWithMissions`).
 *
 * Signing out: `stopSharing` is called by the sign-out (and by every end of a session: `endSession`) before anything else, because the home
 * screen is alive behind the screens above it until the session is cleared, and would go on sending the position of somebody who has just
 * pressed "Se déconnecter". It also forgets every job told here: they were the jobs of that session. A new session begins with `beginSession`.
 *
 * `roadSnapshot` is what Home reads with `useSyncExternalStore`: an immutable value, replaced (never changed) when something that matters
 * changes, so that the screen is drawn again exactly then.
 */

type Listener = () => void;

export interface RoadSnapshot {
  /** The jobs the mission screen has told about: true when under way (on the way, arrived or at work). */
  readonly told: ReadonlyMap<string, boolean>;
  /** True from the moment a sign-out began until a new session begins. */
  readonly signingOut: boolean;
}

let snapshot: RoadSnapshot = { told: new Map(), signingOut: false };
// When each job was told (not part of the snapshot: it changes without anything on the screen changing).
const toldAt = new Map<string, number>();
const listeners = new Set<Listener>();
const stoppers = new Set<() => void>();

function announce() {
  for (const listener of [...listeners]) listener();
}

function replace(next: Partial<RoadSnapshot>) {
  snapshot = { ...snapshot, ...next };
  announce();
}

export function roadSnapshot(): RoadSnapshot {
  return snapshot;
}

/** The status the mission screen holds for a job. A mission with no number is of no use here and is ignored. */
export function noteMissionStatus(id: string | number | null | undefined, status: string | null | undefined, at: number = Date.now()): void {
  if (id === null || id === undefined) return;

  // A mission screen that is still on when the session ends must not leave the job of that session behind for the next one.
  if (snapshot.signingOut) return;

  const key = String(id);
  const now = jobUnderWay([{ status }]);

  toldAt.set(key, at);

  if (snapshot.told.get(key) === now) return;

  replace({ told: new Map(snapshot.told).set(key, now) });
}

/** The job is no longer the technician's work on the road (it was completed, or given back): whatever Home's list still says, it is not under way. */
export function noteMissionLeft(id: string | number | null | undefined, at: number = Date.now()): void {
  noteMissionStatus(id, null, at);
}

/**
 * The home screen has read the list of missions, asked for at `askedAt`: for each job it holds, what the list says is at least as recent as
 * what the mission screen told before `askedAt`, so that is forgotten; what was told after the list was asked for is newer and is kept.
 */
export function reconcileWithMissions(askedAt: number): void {
  const kept = new Map(snapshot.told);
  let changed = false;

  for (const key of [...kept.keys()]) {
    if ((toldAt.get(key) ?? 0) <= askedAt) {
      kept.delete(key);
      toldAt.delete(key);
      changed = true;
    }
  }

  if (changed) replace({ told: kept });
}

/**
 * Whether a job is under way: for each job of the list, what the mission screen told if it told, else what the list says; and a job the
 * mission screen told about that the list does not hold (yet) counts when it is under way.
 */
export function jobsUnderWay(missions: ReadonlyArray<{ id?: string | number | null; status?: string | null }> | null | undefined, road: RoadSnapshot): boolean {
  const listed = new Set<string>();

  for (const mission of missions ?? []) {
    const key = mission.id === null || mission.id === undefined ? null : String(mission.id);
    const told = key === null ? undefined : road.told.get(key);

    if (key !== null) listed.add(key);
    if (told === undefined ? jobUnderWay([mission]) : told) return true;
  }

  for (const [key, underWay] of road.told) {
    if (underWay && !listed.has(key)) return true;
  }

  return false;
}

export function subscribeToRoad(listener: Listener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** The home screen says how to stop its sharing (and gets a way to forget it). */
export function registerSharingStopper(stop: () => void): () => void {
  stoppers.add(stop);

  return () => {
    stoppers.delete(stop);
  };
}

/** A session ends or a sign-out begins: the sharing stops at once, what was told about the jobs is forgotten, and Home is not to start again. */
export function stopSharing(): void {
  toldAt.clear();
  for (const stop of [...stoppers]) stop();
  replace({ told: new Map(), signingOut: true });
}

/** True from the moment a sign-out began until a new session begins. */
export function isSigningOut(): boolean {
  return snapshot.signingOut;
}

/** A session begins (the home screen is shown), or a sign-out did not end the session: the position may go out again. */
export function beginSession(): void {
  if (snapshot.signingOut) replace({ signingOut: false });
}
