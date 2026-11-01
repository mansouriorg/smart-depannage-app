import {
  apiErrorStatus,
  failureKind,
  heldSeconds,
  isQueuedStep,
  isolateFor,
  isTooOld,
  message,
  missionFlow,
  serverHasStep,
  type Locale,
  type QueuedStep,
} from '../lib/shared';

/**
 * The actions the phone keeps until it has a signal (P3-06): the steps of the road (on the way, arrived, start) and the photo that closes the job.
 *
 * What the technician sees: they press "arrivé" in a basement with no signal, the screen moves on ("Commencer les travaux"), and when the
 * connection is back the phone sends what it kept, in order, each with the time it was held (the server dates the action when it was done, not
 * when it arrived: see src/common/time/queued-for.ts on the server). A completion made without signal uploads when the connection returns.
 *
 * How it works:
 *  - Every action goes through here, online or not ("enqueue first"): it is written to the phone, then sent at once. A phone with a signal sees
 *    no difference but a file written before the call; a phone without one has already kept the action when the call fails.
 *  - The file lives on the phone (`queue.json`, with the photos beside it) and survives the app being closed. It is read once at start.
 *  - One send at a time, in the order the actions were made. An answer "no network / the server is not well" keeps the action and plans the
 *    next try later (30 s, 1 min, 2 min, then every 5 min); with no network at all the run stops there (the rest would fail as well), with a
 *    server error it only skips the rest of that job. An answer "409" is looked at (the job may already have the action: the answer was lost);
 *    any other answer is final: the action is dropped, and so is what came after it for that job, and the technician is told why. An action
 *    older than seven days is dropped as well (the server does not count more).
 *  - The actions belong to the person who made them (the user number inside the token of the session). A session of somebody else never sends
 *    them and never shows them; they wait for their owner.
 *
 * Plain TypeScript with the phone's file system, the server, the clock and the timers given, so that it is tested without a phone.
 */

/** The wait before the next try of an action that could not be sent, by number of tries so far. */
export const RETRY_DELAYS_MS = [30_000, 60_000, 120_000, 300_000] as const;

/** The most problems kept for each person to read (the oldest go first). */
export const MAX_PROBLEMS = 20;

/** The shortest wait before the timer wakes the queue: a queue never wakes itself in a loop. */
export const MIN_WAKE_MS = 1_000;

/**
 * The most a call to `submit` waits for its own action to be sent. The run it starts goes through everything that waits, in order, and a photo
 * of another job that is slow to upload (a weak link) would keep the technician's tap on a spinner for as long as the upload takes: past this,
 * the action is told as kept and the screen follows what becomes of it through the events.
 */
export const SUBMIT_WAIT_MS = 15_000;

/**
 * The longest wait a try is ever put off by. A `nextTryAt` further ahead than this was written by a clock that has been set back since (a wrong
 * clock corrected when the network returns): it counts as due, and the timer never waits longer.
 */
export const MAX_RETRY_WAIT_MS = RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];

export function retryDelayMs(tries: number): number {
  const index = Math.min(Math.max(1, Math.floor(tries)), RETRY_DELAYS_MS.length) - 1;

  return RETRY_DELAYS_MS[index];
}

/** The photo that closes a job, as the camera gave it; `uri` is the copy the phone keeps. */
export interface KeptPhoto {
  /** Where the phone keeps its copy (a name given by the store: see `QueueStore.resolvePhoto`); on a photo being added, the camera's own file. */
  readonly uri: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracy?: number;
  readonly mocked?: boolean;
  /** When the photo was taken, as the camera wrote it. */
  readonly capturedAt: string;
}

export interface QueuedEntry {
  readonly id: string;
  /** The person who made the action. */
  readonly userId: string;
  readonly missionId: string;
  readonly step: QueuedStep;
  /** When the action was made, on the phone's clock (milliseconds). */
  readonly madeAt: number;
  /** How many times it was sent and did not get through. */
  readonly tries: number;
  /** Not before (milliseconds, the phone's clock). */
  readonly nextTryAt: number;
  /** Only for the step that closes the job. */
  readonly photo?: KeptPhoto;
}

/**
 * True for an action that could not go at its first try and waits for a later one. This is what a screen calls "waiting": an
 * action that is only being sent (written, and on its way a moment later) is not, and a phone with a signal shows no banner for it.
 */
export function isPutOff(entry: Pick<QueuedEntry, 'tries' | 'nextTryAt'>): boolean {
  return entry.tries > 0 || entry.nextTryAt > 0;
}

export type ProblemKind = 'refused' | 'tooOld' | 'photoMissing' | 'unreadable';

/** An action that was not sent for good, kept until the technician has read it. */
export interface QueueProblem {
  readonly id: string;
  /** Whose action it was; null for a problem of the file itself. */
  readonly userId: string | null;
  readonly missionId: string | null;
  readonly step: QueuedStep | null;
  readonly kind: ProblemKind;
  /** The sentence of the server, for a refusal. */
  readonly reason: string | null;
  readonly at: number;
}

export interface QueueFile {
  readonly version: 1;
  entries: QueuedEntry[];
  problems: QueueProblem[];
}

/** What the queue asks of the phone's file system. */
export interface QueueStore {
  /** The text of the file; null when there is none. Throws when it cannot be read. */
  read(): Promise<string | null>;
  write(text: string): Promise<void>;
  /** Moves a file that cannot be read out of the way, so that it is neither read again nor written over. */
  setAside(): Promise<void>;
  /**
   * Copies the photo into the place the phone keeps; gives back where, as a short name that stays true when the folder of the app moves (the
   * system may give an updated app another path): `resolvePhoto` turns it into the address to read.
   */
  keepPhoto(entryId: string, uri: string): Promise<string>;
  /** The address of a kept photo, to read it or to send it. */
  resolvePhoto(kept: string): string;
  dropPhoto(kept: string): Promise<void>;
  photoExists(kept: string): Promise<boolean>;
  /** Removes the kept photos that are not in the list (left behind by an app that was stopped half way). */
  sweep(keep: readonly string[]): Promise<void>;
}

/** What the queue asks of the server. */
export interface QueueSender {
  /** Does one step; gives back the server's answer (the job). Throws what the HTTP client throws. */
  step(entry: QueuedEntry, heldSeconds: number): Promise<unknown>;
  /** Sends the closing photo. */
  proof(entry: QueuedEntry, heldSeconds: number): Promise<{ needsReview: boolean }>;
  /** The status the server holds for a job. */
  status(missionId: string): Promise<string | null>;
  /** The sentence to tell the technician about a refusal, and the server's code for it if it gave one. */
  describe(error: unknown, entry: QueuedEntry): { reason: string; code: string | null };
}

export interface QueueDeps {
  store: QueueStore;
  send: QueueSender;
  now(): number;
  newId(): string;
  setTimer(run: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  /** The user number of the session that is open now (null when there is none). Read before each send. */
  whoAmI(): Promise<string | null>;
  log?(what: string, detail?: unknown): void;
}

export type QueueEvent =
  | { kind: 'sent'; entry: QueuedEntry; answer: unknown; needsReview: boolean }
  /** The server already had it (the answer of an earlier try was lost). */
  | { kind: 'already'; entry: QueuedEntry }
  | { kind: 'dropped'; entry: QueuedEntry; problem: QueueProblem; code: string | null };

export interface QueueSnapshot {
  /** The file has been read. */
  readonly ready: boolean;
  readonly userId: string | null;
  /** The actions of this person that wait, in the order they were made. */
  readonly entries: readonly QueuedEntry[];
  /** The problems of this person (and of the file itself) that they have not read yet. */
  readonly problems: readonly QueueProblem[];
  /** A send is going on. */
  readonly sending: boolean;
  /** The file could not be read (a phone that is busy or locked): nothing can be added until it has been, and the next call tries again. */
  readonly loadFailed: boolean;
  /** When the next try is planned (the earliest of the actions that wait); null when none waits. */
  readonly nextTryAt: number | null;
}

export type SubmitResult =
  | { kind: 'sent'; answer: unknown; needsReview: boolean }
  /** Still on the phone: it will go when the network is back. */
  | { kind: 'kept' }
  | { kind: 'refused'; problem: QueueProblem; reason: string | null; code: string | null }
  /** The same action is already waiting, or the job is already being closed: nothing was added. */
  | { kind: 'ignored' };

/** The phone could not write the action (no space left, a file that cannot be written): it was not kept. */
export class QueueSaveError extends Error {
  constructor(readonly cause?: unknown) {
    super('QUEUE_SAVE_FAILED');
  }
}

export interface SubmitInput {
  missionId: string;
  step: QueuedStep;
  /** Required for the step that closes the job. */
  photo?: KeptPhoto;
}

type Listener = () => void;

const EMPTY: QueueSnapshot = { ready: false, userId: null, entries: [], problems: [], sending: false, loadFailed: false, nextTryAt: null };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function readPhoto(raw: unknown): KeptPhoto | null {
  if (!raw || typeof raw !== 'object') return null;

  const photo = raw as Record<string, unknown>;

  if (typeof photo.uri !== 'string' || !photo.uri) return null;
  if (!isFiniteNumber(photo.latitude) || !isFiniteNumber(photo.longitude)) return null;
  if (typeof photo.capturedAt !== 'string') return null;

  return {
    uri: photo.uri,
    latitude: photo.latitude,
    longitude: photo.longitude,
    ...(isFiniteNumber(photo.accuracy) ? { accuracy: photo.accuracy } : {}),
    ...(typeof photo.mocked === 'boolean' ? { mocked: photo.mocked } : {}),
    capturedAt: photo.capturedAt,
  };
}

function readEntry(raw: unknown): QueuedEntry | null {
  if (!raw || typeof raw !== 'object') return null;

  const entry = raw as Record<string, unknown>;

  if (typeof entry.id !== 'string' || !entry.id) return null;
  if (typeof entry.userId !== 'string' || !entry.userId) return null;
  if (typeof entry.missionId !== 'string' || !entry.missionId) return null;
  if (typeof entry.step !== 'string' || !isQueuedStep(entry.step)) return null;
  if (!isFiniteNumber(entry.madeAt)) return null;

  const tries = isFiniteNumber(entry.tries) && entry.tries >= 0 ? Math.floor(entry.tries) : 0;
  const nextTryAt = isFiniteNumber(entry.nextTryAt) && entry.nextTryAt >= 0 ? entry.nextTryAt : 0;
  const base = { id: entry.id, userId: entry.userId, missionId: entry.missionId, step: entry.step, madeAt: entry.madeAt, tries, nextTryAt };

  if (entry.step === 'complete') {
    const photo = readPhoto(entry.photo);

    return photo ? { ...base, photo } : null;
  }

  return base;
}

const PROBLEM_KINDS: readonly string[] = ['refused', 'tooOld', 'photoMissing', 'unreadable'];

function readProblem(raw: unknown): QueueProblem | null {
  if (!raw || typeof raw !== 'object') return null;

  const problem = raw as Record<string, unknown>;

  if (typeof problem.id !== 'string' || !problem.id) return null;
  if (typeof problem.kind !== 'string' || !PROBLEM_KINDS.includes(problem.kind)) return null;
  if (!isFiniteNumber(problem.at)) return null;

  return {
    id: problem.id,
    userId: typeof problem.userId === 'string' ? problem.userId : null,
    missionId: typeof problem.missionId === 'string' ? problem.missionId : null,
    step: typeof problem.step === 'string' && isQueuedStep(problem.step) ? problem.step : null,
    kind: problem.kind as ProblemKind,
    reason: typeof problem.reason === 'string' ? problem.reason : null,
    at: problem.at,
  };
}

/** Reads the text of the file. Null when it is not a queue file; `skipped` counts what was left out of one that is. */
export function parseQueueFile(text: string): { file: QueueFile; skipped: number } | null {
  let raw: unknown;

  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }

  if (!raw || typeof raw !== 'object') return null;

  const data = raw as Record<string, unknown>;

  if (data.version !== 1 || !Array.isArray(data.entries) || !Array.isArray(data.problems)) return null;

  const entries: QueuedEntry[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const item of data.entries) {
    const entry = readEntry(item);

    // An entry twice with the same number would be sent twice (and its photo dropped once): the first one counts.
    if (!entry || seen.has(entry.id)) {
      skipped += 1;
      continue;
    }

    seen.add(entry.id);
    entries.push(entry);
  }

  const problems = data.problems.map(readProblem).filter((problem): problem is QueueProblem => problem !== null);

  return { file: { version: 1, entries, problems }, skipped };
}

/** The user number inside the token of a session (the `sub` the server wrote), without checking the token: only to tell whose actions these are. */
export function userIdOfToken(token: string | null | undefined): string | null {
  if (!token) return null;

  const part = token.split('.')[1];

  if (!part) return null;

  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const bytes: number[] = [];
    let buffer = 0;
    let bits = 0;

    for (const char of padded) {
      if (char === '=') break;

      const value = alphabet.indexOf(char);

      if (value < 0) return null;

      buffer = (buffer << 6) | value;
      bits += 6;

      if (bits >= 8) {
        bits -= 8;
        bytes.push((buffer >> bits) & 0xff);
      }
    }

    // Read as plain characters (the other claims may hold letters that this does not decode; only `sub` is used, and it is digits).
    let text = '';

    for (let index = 0; index < bytes.length; index += 1) {
      text += String.fromCharCode(bytes[index]);
    }

    const claims = JSON.parse(text) as { sub?: unknown };

    if (typeof claims.sub === 'number' && Number.isSafeInteger(claims.sub)) return String(claims.sub);
    if (typeof claims.sub === 'string' && claims.sub.trim()) return claims.sub.trim();

    return null;
  } catch {
    return null;
  }
}

/** The sentence that tells the technician what happened to an action that was not sent. */
export function problemMessage(problem: QueueProblem, locale: Locale): string {
  const label = problem.step ? (missionFlow(locale).find((entry) => entry.step === problem.step)?.label ?? '') : '';
  // The server's sentence is French (or whatever it wrote): inside an Arabic sentence it is set apart so that its punctuation stays where it is.
  const reason = isolateFor(locale, problem.reason ?? '');

  switch (problem.kind) {
    case 'refused':
      return problem.step === 'complete'
        ? message(locale, 'app.offline.refusedProof', { reason })
        : message(locale, 'app.offline.refused', { action: label, reason });
    case 'tooOld':
      return message(locale, 'app.offline.tooOld', { action: label });
    case 'photoMissing':
      return message(locale, 'app.offline.photoMissing');
    case 'unreadable':
      return message(locale, 'app.offline.unreadable');
  }
}

type Attempt = 'next' | 'block' | 'stop';

export class OfflineQueue {
  private file: QueueFile = { version: 1, entries: [], problems: [] };
  private userId: string | null = null;
  private ready = false;
  private sending = false;
  private snapshot: QueueSnapshot = EMPTY;
  private readonly listeners = new Set<Listener>();
  private readonly eventListeners = new Set<(event: QueueEvent) => void>();
  private starting: Promise<void> | null = null;
  // The file could not be read (as opposed to read and found damaged): nothing is written over it, and the next start reads it again.
  private loadFailed = false;
  private running: Promise<void> | null = null;
  private again = false;
  private forceNext = false;
  private writing: Promise<void> = Promise.resolve();
  private timer: unknown = null;
  // The actions being added (the photo is still being copied): the same action twice is added once.
  private readonly adding = new Set<string>();
  // The actions that are in memory and not yet written to the phone: none is sent before it is on the phone ("enqueue first"), whatever run
  // is going when it is added.
  private readonly unwritten = new Set<string>();
  // The actions a call of `submit` is waiting for (it is woken when one is sent, refused or put off), and what became of them. Kept only for
  // those: nothing piles up for an action that a timer sends later.
  private readonly awaited = new Map<string, () => void>();
  private readonly outcomes = new Map<string, QueueEvent>();

  constructor(private readonly deps: QueueDeps) {}

  // ---- reading --------------------------------------------------------------------------------

  getSnapshot = (): QueueSnapshot => this.snapshot;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  onEvent(listener: (event: QueueEvent) => void): () => void {
    this.eventListeners.add(listener);

    return () => {
      this.eventListeners.delete(listener);
    };
  }

  /** The steps of this person that wait for a job, in order. */
  pendingSteps(missionId: string): QueuedStep[] {
    return this.snapshot.entries.filter((entry) => entry.missionId === missionId).map((entry) => entry.step);
  }

  // ---- start and user -------------------------------------------------------------------------

  /** Reads the file (once). Safe to call again. */
  start(): Promise<void> {
    if (!this.starting) {
      const loading: Promise<void> = this.load().then(() => {
        // A file that could not be read is read again by the next call (a phone that is locked or busy answers a moment later).
        if (this.loadFailed && this.starting === loading) this.starting = null;
      });

      this.starting = loading;
    }

    return this.starting;
  }

  private async load(): Promise<void> {
    let text: string | null = null;
    let unreadable = false;

    try {
      text = await this.deps.store.read();
      this.loadFailed = false;
    } catch (error) {
      // Not the same as a file found damaged: it may be fine and only out of reach for a moment (a locked phone, a busy disk). Nothing is set
      // aside and nothing is written over it; no action is taken until it has been read.
      this.deps.log?.('queue file could not be read', error);
      this.loadFailed = true;
      this.publish();

      return;
    }

    if (text !== null && !unreadable) {
      const parsed = parseQueueFile(text);

      if (parsed) {
        this.file = parsed.file;
        unreadable = parsed.skipped > 0;
      } else {
        unreadable = true;
      }
    }

    if (unreadable) {
      // What could be read is kept (if any); the file itself is moved aside only when nothing of it could be used.
      if (this.file.entries.length === 0 && this.file.problems.length === 0) {
        try {
          await this.deps.store.setAside();
        } catch (error) {
          this.deps.log?.('queue file could not be set aside', error);
        }
      }

      this.addProblem({ userId: null, missionId: null, step: null, kind: 'unreadable', reason: null });
      await this.persist().catch((error) => this.deps.log?.('queue file could not be written', error));
    }

    // Not after a file that was damaged: the photos it named (the proof of a job done) are not deleted in the same breath as the file is given up
    // (the next start sweeps those that no action names).
    if (!unreadable) {
      try {
        await this.deps.store.sweep(this.file.entries.flatMap((entry) => (entry.photo ? [entry.photo.uri] : [])));
      } catch (error) {
        this.deps.log?.('kept photos could not be swept', error);
      }
    }

    this.ready = true;
    this.publish();
    this.plan();
  }

  /** Tells the queue whose session is open now (null: none). The actions of anybody else wait. */
  setUser(userId: string | null): void {
    if (userId === this.userId) return;

    this.userId = userId;
    this.publish();
    this.plan();

    if (userId !== null && this.ready) void this.flush();
  }

  // ---- adding ---------------------------------------------------------------------------------

  /**
   * Keeps an action and tries to send it at once. Gives back what became of it: sent, or still kept (no network), or refused for good.
   * Throws `QueueSaveError` when the phone could not keep it (the action was not made).
   */
  async submit(input: SubmitInput): Promise<SubmitResult> {
    await this.start();

    if (this.loadFailed) throw new QueueSaveError(new Error('QUEUE_NOT_READ'));

    let userId: string | null;

    try {
      userId = await this.deps.whoAmI();
    } catch (error) {
      // The keychain cannot be read just now: nothing is kept (whose action it would be is not known), and the person is told it was not made
      // (a code of its own: it is not a phone that cannot write).
      this.deps.log?.('session could not be read', error);
      throw new QueueSaveError(new Error('SESSION_UNREADABLE'));
    }

    if (userId === null) throw new QueueSaveError(new Error('NO_SESSION'));

    if (this.userId !== userId) this.setUser(userId);

    if (!isQueuedStep(input.step) || !input.missionId) throw new QueueSaveError(new Error('NOT_A_QUEUED_STEP'));
    if (input.step === 'complete' && !input.photo) throw new QueueSaveError(new Error('NO_PHOTO'));

    const key = `${userId}:${input.missionId}:${input.step}`;
    const mine = this.file.entries.filter((entry) => entry.userId === userId && entry.missionId === input.missionId);

    // The same action twice (a double tap), or anything after the photo that closes the job.
    if (this.adding.has(key) || mine.some((entry) => entry.step === input.step || entry.step === 'complete')) return { kind: 'ignored' };

    this.adding.add(key);

    let entry: QueuedEntry;

    try {
      const id = this.deps.newId();
      let photo: KeptPhoto | undefined;

      if (input.step === 'complete' && input.photo) {
        let kept: string;

        try {
          kept = await this.deps.store.keepPhoto(id, input.photo.uri);
        } catch (error) {
          throw new QueueSaveError(error);
        }

        photo = { ...input.photo, uri: kept };
      }

      entry = { id, userId, missionId: input.missionId, step: input.step, madeAt: this.deps.now(), tries: 0, nextTryAt: 0, ...(photo ? { photo } : {}) };
      this.unwritten.add(entry.id);
      this.file.entries.push(entry);

      try {
        await this.persist();
        this.unwritten.delete(entry.id);
      } catch (error) {
        this.unwritten.delete(entry.id);
        this.file.entries = this.file.entries.filter((other) => other.id !== entry.id);
        this.publish();

        // The write that failed, or another one that went on meanwhile, may have left the action on disk: the file is written again without it
        // (best effort), so that an action the person was told was not kept is not sent after a restart. The photo goes only when that write
        // went through (a file that may still name the action keeps the photo it names; the sweep of the next start removes it otherwise).
        let rolledBack = true;

        await this.persist().catch((writeError) => {
          rolledBack = false;
          this.deps.log?.('queue file could not be written', writeError);
        });

        if (photo && rolledBack) void this.deps.store.dropPhoto(photo.uri).catch(() => undefined);

        throw new QueueSaveError(error);
      }
    } finally {
      this.adding.delete(key);
    }

    this.publish();

    // The person pressed it: what waits for a later try for this job goes now too. The call is answered as soon as this action is sent, refused
    // or put off (the run goes on without it), or when the run ends, and in any case after SUBMIT_WAIT_MS.
    let wake: () => void = () => undefined;
    const woken = new Promise<void>((resolve) => {
      wake = resolve;
    });

    this.awaited.set(entry.id, wake);

    await this.within(Promise.race([woken, this.flush({ force: true })]), SUBMIT_WAIT_MS);

    const outcome = this.outcomes.get(entry.id);

    this.outcomes.delete(entry.id);
    this.awaited.delete(entry.id);

    if (!outcome) return { kind: 'kept' };

    switch (outcome.kind) {
      case 'sent':
        return { kind: 'sent', answer: outcome.answer, needsReview: outcome.needsReview };
      case 'already':
        return { kind: 'sent', answer: undefined, needsReview: false };
      case 'dropped':
        return { kind: 'refused', problem: outcome.problem, reason: outcome.problem.reason, code: outcome.code };
    }
  }

  /** Waits for a promise, but no longer than `ms` (on the queue's own timer). */
  private within(promise: Promise<void>, ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const handle = this.deps.setTimer(() => resolve(), ms);

      void promise.then(
        () => {
          this.deps.clearTimer(handle);
          resolve();
        },
        () => {
          this.deps.clearTimer(handle);
          resolve();
        },
      );
    });
  }

  // ---- sending --------------------------------------------------------------------------------

  /** Sends what waits. One run at a time: a call that comes while one is going on makes it go round once more. */
  flush(options: { force?: boolean } = {}): Promise<void> {
    if (options.force) this.forceNext = true;

    if (this.running) {
      this.again = true;

      return this.running;
    }

    this.running = this.loop().finally(() => {
      this.running = null;
      this.sending = false;
      this.publish();
      this.plan();
    });

    return this.running;
  }

  private async loop(): Promise<void> {
    await this.start();

    do {
      this.again = false;

      const force = this.forceNext;

      this.forceNext = false;

      try {
        await this.run(force);
      } catch (error) {
        // A run never ends the queue: the next one starts from the file.
        this.deps.log?.('queue run failed', error);
      }
    } while (this.again);
  }

  private async run(force: boolean): Promise<void> {
    if (this.loadFailed) return;

    // No session known yet: the first reading of the keychain at the start of the app may have failed (a locked phone), and nothing else asks
    // again. It is asked here; a keychain that still cannot be read leaves things as they are.
    if (!this.userId && this.ready) {
      try {
        const who = await this.deps.whoAmI();

        if (who !== null && !this.userId) this.setUser(who);
      } catch (error) {
        this.deps.log?.('session could not be read', error);
      }
    }

    if (!this.userId) return;

    const user = this.userId;
    const blocked = new Set<string>();
    const mine = this.file.entries.filter((entry) => entry.userId === user);
    // The short calls first, the photos after: a step of one job never waits behind the upload of another job's photo. Nothing changes inside a
    // job, whose closing photo is always its last action.
    const order = [...mine.filter((entry) => entry.step !== 'complete'), ...mine.filter((entry) => entry.step === 'complete')].map((entry) => entry.id);

    for (const id of order) {
      // The session may have changed while an action was on its way: the actions of the new one are for a new run.
      if (this.userId !== user) return;

      const entry = this.file.entries.find((other) => other.id === id);

      // Already gone: dropped with an earlier action of the same job.
      if (!entry || blocked.has(entry.missionId)) continue;

      // Not on the phone yet: the call that is adding it sends it as soon as it is.
      if (this.unwritten.has(entry.id)) {
        blocked.add(entry.missionId);
        continue;
      }

      if (!force && entry.nextTryAt > this.deps.now() && entry.nextTryAt - this.deps.now() <= MAX_RETRY_WAIT_MS) {
        blocked.add(entry.missionId);
        continue;
      }

      // Whose session is open really? The token is read again before each send: after a sign-out and another person's sign-in, the first
      // person's actions must not go out in the second one's name.
      let who: string | null;

      try {
        who = await this.deps.whoAmI();
      } catch (error) {
        // The keychain cannot be read just now (a locked phone): whose session is open is not known, and a request without its token could even end
        // the session. Nothing is sent; the user stays what it was, and the action waits like any other.
        this.deps.log?.('session could not be read', error);
        this.later(entry, error, true, false);

        return;
      }

      if (who !== user) {
        this.setUser(who);
        return;
      }

      this.sending = true;
      this.publish();

      const result = await this.attempt(entry);

      if (result === 'stop') return;
      if (result === 'block') blocked.add(entry.missionId);
    }
  }

  private async attempt(entry: QueuedEntry): Promise<Attempt> {
    try {
      return await this.attemptNow(entry);
    } catch (error) {
      // Something the queue did not expect (the phone's own file system, say): the action stays, and waits like any other.
      this.deps.log?.('queue attempt failed', error);

      return this.later(entry, error, true);
    }
  }

  private async attemptNow(entry: QueuedEntry): Promise<Attempt> {
    const now = this.deps.now();

    if (isTooOld(entry.madeAt, now)) return this.drop(entry, 'tooOld', null, null);

    if (entry.step === 'complete' && entry.photo) {
      let there = true;

      try {
        there = await this.deps.store.photoExists(entry.photo.uri);
      } catch {
        // Not known: the send will say.
      }

      if (!there) return this.drop(entry, 'photoMissing', null, null);
    }

    const held = heldSeconds(entry.madeAt, now);
    let sent: QueueEvent;

    try {
      if (entry.step === 'complete') {
        const proof = await this.deps.send.proof(entry, held);

        sent = { kind: 'sent', entry, answer: undefined, needsReview: proof.needsReview };
      } else {
        sent = { kind: 'sent', entry, answer: await this.deps.send.step(entry, held), needsReview: false };
      }
    } catch (error) {
      switch (failureKind(error)) {
        case 'retry':
          return this.later(entry, error, false);
        case 'conflict':
          return this.conflict(entry, error);
        default:
          return this.refuse(entry, error);
      }
    }

    await this.settle(sent);

    return 'next';
  }

  /** The server said 409: the job is not in a state that takes this. If it already has the action, that is all; otherwise it is refused. */
  private async conflict(entry: QueuedEntry, error: unknown): Promise<Attempt> {
    let status: string | null;

    try {
      status = await this.deps.send.status(entry.missionId);
    } catch (readError) {
      return failureKind(readError) === 'refused' ? this.refuse(entry, readError) : this.later(entry, readError, false);
    }

    if (serverHasStep(status, entry.step)) {
      await this.settle({ kind: 'already', entry });

      return 'next';
    }

    return this.refuse(entry, error);
  }

  /** Keeps the action and plans the next try. With no answer at all (or none that tells about the server), the whole run stops. */
  private later(entry: QueuedEntry, error: unknown, unexpected: boolean, countTry = true): Attempt {
    // (`countTry` false: the action did nothing wrong, the phone could not tell whose session is open; it waits at the step it was at.)
    const tries = countTry ? entry.tries + 1 : entry.tries;
    const until = this.deps.now() + retryDelayMs(tries);
    const status = unexpected ? null : apiErrorStatus(error);
    // Only a server that answers "I am not well" (5xx) is a problem of that job; the rest (no answer, a session that did not renew, too many
    // requests) would fail the same for every job.
    const wholeQueue = status === null || status < 500;

    this.file.entries = this.file.entries.map((other) => {
      if (other.id === entry.id) return { ...other, tries, nextTryAt: until };

      const concerned = other.userId === entry.userId && (wholeQueue || other.missionId === entry.missionId);

      return concerned && other.nextTryAt < until ? { ...other, nextTryAt: until } : other;
    });

    this.publish();
    // (Nothing is planned while a run is going: this only puts away a wake-up that was planned before it began.)
    this.plan();

    // The call that is waiting for this action has its answer once the file says so: it is kept.
    const waiting = this.awaited.get(entry.id);

    void this.persist()
      .catch((writeError) => this.deps.log?.('queue file could not be written', writeError))
      .finally(() => waiting?.());

    return wholeQueue ? 'stop' : 'block';
  }

  /** The server will not take it, and asking again will not change that: it goes, and so does what came after it for the same job. */
  private async refuse(entry: QueuedEntry, error: unknown): Promise<Attempt> {
    let described = { reason: '', code: null as string | null };

    try {
      described = this.deps.send.describe(error, entry);
    } catch {
      // the words are optional
    }

    return this.drop(entry, 'refused', described.reason || null, described.code);
  }

  private async drop(entry: QueuedEntry, kind: ProblemKind, reason: string | null, code: string | null): Promise<Attempt> {
    const position = this.file.entries.findIndex((other) => other.id === entry.id);
    // A refusal takes with it what came after it for the same job (those actions assume this one was done). An action that is only too old,
    // or whose photo is gone, takes nothing with it: what follows is tried, and the server says what it thinks.
    const doomed =
      kind === 'refused'
        ? this.file.entries.filter((other, index) => other.id === entry.id || (index > position && other.userId === entry.userId && other.missionId === entry.missionId))
        : [entry];

    for (const gone of doomed) {
      const problem = this.addProblem({ userId: gone.userId, missionId: gone.missionId, step: gone.step, kind, reason });

      await this.settle({ kind: 'dropped', entry: gone, problem, code });
    }

    return kind === 'refused' ? 'block' : 'next';
  }

  /** An action is over (sent, already there, or dropped): it leaves the file, its photo goes, and whoever waits for it is told. */
  private async settle(event: QueueEvent): Promise<void> {
    this.file.entries = this.file.entries.filter((other) => other.id !== event.entry.id);

    const waiting = this.awaited.get(event.entry.id);

    if (waiting) this.outcomes.set(event.entry.id, event);

    // Whoever shows the job is told in the same breath as the list changes, before anything is awaited: between the action leaving the list and
    // the news of its answer, a screen would draw the server's old status with the actions that remain (a step that already left offered again).
    for (const listener of [...this.eventListeners]) {
      try {
        listener(event);
      } catch (error) {
        this.deps.log?.('queue listener failed', error);
      }
    }

    this.publish();
    this.plan();

    try {
      await this.persist();

      if (event.entry.photo) void this.deps.store.dropPhoto(event.entry.photo.uri).catch(() => undefined);
    } catch (error) {
      // Not fatal: at the next start the action is sent again, the server answers 409, and the phone sees that it already has it. Its photo stays
      // until then (the file still names it); the next start sweeps what no entry names.
      this.deps.log?.('queue file could not be written', error);
    } finally {
      // The call that is waiting for this action is answered once the file has been written (or has failed to be).
      waiting?.();
    }
  }

  // ---- problems -------------------------------------------------------------------------------

  private addProblem(fields: Omit<QueueProblem, 'id' | 'at'>): QueueProblem {
    const problem: QueueProblem = { id: this.deps.newId(), at: this.deps.now(), ...fields };

    // The oldest of this person's go first (one person's flood of problems never pushes out another person's).
    const theirs = this.file.problems.filter((other) => other.userId === problem.userId);
    const surplus = new Set(theirs.slice(0, Math.max(0, theirs.length + 1 - MAX_PROBLEMS)).map((other) => other.id));

    this.file.problems = [...this.file.problems.filter((other) => !surplus.has(other.id)), problem];

    return problem;
  }

  /** The technician has read it: one problem, or all of theirs. */
  async dismiss(problemId?: string): Promise<void> {
    await this.start();

    // A file that has not been read is not rewritten.
    if (this.loadFailed) return;

    const mine = (problem: QueueProblem) => problem.userId === null || problem.userId === this.userId;

    this.file.problems = this.file.problems.filter((problem) => (problemId === undefined ? !mine(problem) : problem.id !== problemId));
    this.publish();

    await this.persist().catch((error) => this.deps.log?.('queue file could not be written', error));
  }

  // ---- the file, the snapshot, the timer ------------------------------------------------------

  private persist(): Promise<void> {
    const text = JSON.stringify(this.file);

    // Writes go one after the other, each with the state at the moment it was asked for: the last one on disk is the latest.
    this.writing = this.writing.catch(() => undefined).then(() => this.deps.store.write(text));

    return this.writing;
  }

  private publish(): void {
    const user = this.userId;
    const entries = user === null ? [] : this.file.entries.filter((entry) => entry.userId === user);
    const problems = this.file.problems.filter((problem) => problem.userId === null || (user !== null && problem.userId === user));
    // Inside a job each action waits for the one before it: the job goes when its first action does.
    const firstOfJob = new Map<string, QueuedEntry>();

    for (const entry of entries) if (!firstOfJob.has(entry.missionId)) firstOfJob.set(entry.missionId, entry);

    const nextTryAt = entries.length === 0 ? null : Math.min(...[...firstOfJob.values()].map((entry) => entry.nextTryAt));

    this.snapshot = { ready: this.ready, userId: user, entries, problems, sending: this.sending, loadFailed: this.loadFailed, nextTryAt };

    for (const listener of [...this.listeners]) listener();
  }

  /** Plans the wake-up for the earliest action that waits. */
  private plan(): void {
    if (this.timer !== null) {
      this.deps.clearTimer(this.timer);
      this.timer = null;
    }

    if (this.running || this.snapshot.nextTryAt === null) return;

    const wait = Math.min(MAX_RETRY_WAIT_MS, Math.max(MIN_WAKE_MS, this.snapshot.nextTryAt - this.deps.now()));

    this.timer = this.deps.setTimer(() => {
      this.timer = null;
      void this.flush();
    }, wait);
  }
}

export function createOfflineQueue(deps: QueueDeps): OfflineQueue {
  return new OfflineQueue(deps);
}
