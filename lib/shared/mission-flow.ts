import type { MissionRejectionReason } from './generated/enums';
import { DEFAULT_LOCALE, type Locale } from './generated/i18n';
import { CanonicalStatus, canonicalStatus, checkTransition } from './generated/intervention-status';
import { message } from './i18n';

/** The reasons for a refusal, as the server names them (the apps import the type from here). */
export type { MissionRejectionReason };

/**
 * The steps of a mission, in the order the artisan does them (P1-15).
 *
 * The mobile app shows ONE button at a time: the next step of the job. Which step is next is written
 * here; whether the step is allowed is asked of the server's status table (`checkTransition`), so a
 * step the table stops allowing stops being offered, and the shortcuts the table still lets old apps
 * take (from "assigned" straight to "in progress") are never offered by this app.
 *
 * `complete` is the one step that is not a call of its own: the job is closed by the photo that proves
 * the work (POST /interventions/:id/complete-work), so the app opens the camera instead.
 *
 * The words (the buttons, the reasons, the milestones, the piles) are in the catalogue (`mission.*`, `artisan.availability.*`, French
 * and Arabic, P3-04). The constants below (`MISSION_FLOW`, `DECLINE_REASONS`, `MISSION_BUCKETS`, `AVAILABILITY_LABELS`) keep their French
 * words; the same table in a language is `missionFlow(locale)`, `declineReasons(locale)`, `missionBuckets(locale)`, `availabilityLabels(locale)`.
 */
export type MissionStep = 'accept' | 'on-the-way' | 'arrived' | 'start' | 'complete';

export interface MissionStepInfo {
  readonly step: MissionStep;
  /** The status the job must be in. */
  readonly from: CanonicalStatus;
  /** The status the step puts it in. */
  readonly to: CanonicalStatus;
  /** What the button says. */
  readonly label: string;
  /** What the button says while the call is on its way. */
  readonly busyLabel: string;
  /** The field of the job that records when the step was done. */
  readonly doneAt: MissionMoment;
  /** The step is done with a photo, not with a plain call. */
  readonly needsProof: boolean;
}

/** The fields of a job that record the moments of a mission. */
export type MissionMoment =
  | 'assignedAt'
  | 'artisanAcceptedAt'
  | 'artisanOnTheWayAt'
  | 'artisanArrivedAt'
  | 'workStartedAt'
  | 'workCompletedAt';

/** The key of each step in the catalogue (`mission.flow.<key>`, `mission.milestones.<key>`): the step ids with the hyphen written as a capital. */
const WORDS_KEY: Record<MissionStep, 'accept' | 'onTheWay' | 'arrived' | 'start' | 'complete'> = {
  accept: 'accept',
  'on-the-way': 'onTheWay',
  arrived: 'arrived',
  start: 'start',
  complete: 'complete',
};

/** The steps without their words. */
const FLOW: ReadonlyArray<Omit<MissionStepInfo, 'label' | 'busyLabel'>> = [
  { step: 'accept', from: 'ASSIGNED', to: 'ARTISAN_ACCEPTED', doneAt: 'artisanAcceptedAt', needsProof: false },
  { step: 'on-the-way', from: 'ARTISAN_ACCEPTED', to: 'ARTISAN_ON_THE_WAY', doneAt: 'artisanOnTheWayAt', needsProof: false },
  { step: 'arrived', from: 'ARTISAN_ON_THE_WAY', to: 'ARTISAN_ARRIVED', doneAt: 'artisanArrivedAt', needsProof: false },
  { step: 'start', from: 'ARTISAN_ARRIVED', to: 'IN_PROGRESS', doneAt: 'workStartedAt', needsProof: false },
  { step: 'complete', from: 'IN_PROGRESS', to: 'COMPLETED', doneAt: 'workCompletedAt', needsProof: true },
];

function withWords(entry: Omit<MissionStepInfo, 'label' | 'busyLabel'>, locale: Locale): MissionStepInfo {
  const key = WORDS_KEY[entry.step];

  return {
    step: entry.step,
    from: entry.from,
    to: entry.to,
    label: message(locale, `mission.flow.${key}.label`),
    busyLabel: message(locale, `mission.flow.${key}.busy`),
    doneAt: entry.doneAt,
    needsProof: entry.needsProof,
  };
}

/** The steps of a mission in a language. */
export function missionFlow(locale: Locale = DEFAULT_LOCALE): readonly MissionStepInfo[] {
  return FLOW.map((entry) => withWords(entry, locale));
}

/** The steps of a mission, in French. */
export const MISSION_FLOW: readonly MissionStepInfo[] = missionFlow('fr');

/** Whether the status table lets an artisan move a job from one status to the other. */
function tableAllowsArtisan(from: CanonicalStatus, to: CanonicalStatus): boolean {
  return checkTransition(from, to, 'artisan').ok;
}

/**
 * The step the artisan does next on a job in this status; null when there is none (done, cancelled, not theirs yet).
 * `allowed` is the server's table (the default); a test passes another one to see a step disappear when the table
 * stops allowing it.
 */
export function nextMissionStep(
  status: string | null | undefined,
  allowed: (from: CanonicalStatus, to: CanonicalStatus) => boolean = tableAllowsArtisan,
  locale: Locale = DEFAULT_LOCALE,
): MissionStepInfo | null {
  const current = canonicalStatus(status);

  if (!current) return null;

  const step = FLOW.find((entry) => entry.from === current);

  if (!step) return null;

  // The server's table has the last word: a step it no longer allows an artisan is not offered.
  return allowed(current, step.to) ? withWords(step, locale) : null;
}

/** What the artisan can do to hand a job back, in this status (null: they cannot). */
export interface MissionRefusal {
  readonly label: string;
  /** The title of the question that asks why. */
  readonly question: string;
}

/**
 * Handing a job back: a refusal before the job was accepted, a "give back" after. Not once the work has
 * started (the table gives the artisan no way back from "in progress": it goes to the back office).
 */
export function missionRefusal(status: string | null | undefined, locale: Locale = DEFAULT_LOCALE): MissionRefusal | null {
  const current = canonicalStatus(status);

  if (!current) return null;

  // (A job that already waits in the queue has nothing to hand back: "same status" is not a way back.)
  if (current === 'WAITING_ADMIN_REVIEW' || !checkTransition(current, 'WAITING_ADMIN_REVIEW', 'artisan').ok) {
    return null;
  }

  return current === 'ASSIGNED'
    ? { label: message(locale, 'mission.refusal.refuse.label'), question: message(locale, 'mission.refusal.refuse.question') }
    : { label: message(locale, 'mission.refusal.giveBack.label'), question: message(locale, 'mission.refusal.giveBack.question') };
}

/** The reasons an artisan can give for a refusal, as the server knows them (`MissionRejectionReason`), in the order they are offered. */
const DECLINE_VALUES: readonly MissionRejectionReason[] = ['NOT_AVAILABLE', 'TOO_FAR', 'OUT_OF_SPECIALTY', 'PRICE_TOO_LOW', 'OTHER'];

/** The reasons an artisan can give for a refusal, with their words in a language. */
export function declineReasons(locale: Locale = DEFAULT_LOCALE): ReadonlyArray<{ value: MissionRejectionReason; label: string }> {
  return DECLINE_VALUES.map((value) => ({ value, label: message(locale, `mission.decline.${value}`) }));
}

/** The reasons an artisan can give for a refusal, as the server knows them, with their French words. */
export const DECLINE_REASONS: ReadonlyArray<{ value: MissionRejectionReason; label: string }> = declineReasons('fr');

export interface MissionMoments {
  assignedAt?: string | null;
  artisanAcceptedAt?: string | null;
  artisanOnTheWayAt?: string | null;
  artisanArrivedAt?: string | null;
  workStartedAt?: string | null;
  workCompletedAt?: string | null;
  status?: string | null;
}

export interface MissionMilestone {
  readonly key: 'assigned' | MissionStep;
  readonly label: string;
  /** When it happened (an ISO date), or null. */
  readonly at: string | null;
  readonly done: boolean;
  /** The one the job is waiting on. */
  readonly current: boolean;
}

/** The key of each milestone in the catalogue (`mission.milestones.<key>`). */
const MILESTONE_KEYS: Record<MissionMilestone['key'], 'assigned' | 'accept' | 'onTheWay' | 'arrived' | 'start' | 'complete'> = {
  assigned: 'assigned',
  accept: 'accept',
  'on-the-way': 'onTheWay',
  arrived: 'arrived',
  start: 'start',
  complete: 'complete',
};

/** How far a status is along the mission (0: assigned … 5: done). Statuses outside the mission have no place. */
const STAGE_OF_STATUS: Partial<Record<CanonicalStatus, number>> = {
  ASSIGNED: 0,
  ARTISAN_ACCEPTED: 1,
  ARTISAN_ON_THE_WAY: 2,
  ARTISAN_ARRIVED: 3,
  IN_PROGRESS: 4,
  WAITING_CLIENT_VALIDATION: 5,
  COMPLETED: 5,
  PAYMENT_PENDING: 5,
  PAID: 5,
  INVOICE_SENT: 5,
};

/** The three piles an artisan sorts their missions in: to accept, under way, over. */
export type MissionBucket = 'todo' | 'active' | 'done';

const BUCKET_IDS: readonly MissionBucket[] = ['todo', 'active', 'done'];

/** The three piles with their words in a language. */
export function missionBuckets(locale: Locale = DEFAULT_LOCALE): ReadonlyArray<{ id: MissionBucket; label: string }> {
  return BUCKET_IDS.map((id) => ({ id, label: message(locale, `mission.buckets.${id}`) }));
}

/** The three piles with their French words. */
export const MISSION_BUCKETS: ReadonlyArray<{ id: MissionBucket; label: string }> = missionBuckets('fr');

/**
 * Which pile a mission is in, from its status: "to accept" while it is only assigned, "under way" from the
 * acceptance to the end of the work, "over" once the work is closed (whatever the payment is doing). A job that is
 * cancelled, in dispute or back in the queue is in none: only the unfiltered list shows it.
 */
export function missionBucketOf(status: string | null | undefined): MissionBucket | null {
  const canonical = canonicalStatus(status);
  const stage = canonical ? STAGE_OF_STATUS[canonical] : undefined;

  if (stage === undefined) return null;

  if (stage === 0) return 'todo';

  return stage < 5 ? 'active' : 'done';
}

/**
 * The line of a mission: every step, with the moment the server recorded it. The status of the job says how far
 * it is: a step is done when the job has reached it, with its moment when the server recorded one (a job moved
 * by the back office can be ahead of its moments), and a moment left over from an earlier artisan on a job that
 * was handed over again is not shown. A job whose status is outside the mission (cancelled, in dispute) is
 * read from its moments alone and waits on no step. The step the job waits on is the `current` one.
 */
export function missionTimeline(job: MissionMoments, locale: Locale = DEFAULT_LOCALE): MissionMilestone[] {
  const current = canonicalStatus(job.status);
  const position = current ? STAGE_OF_STATUS[current] : undefined;

  const rows: Array<{ key: MissionMilestone['key']; moment: MissionMoment; stage: number }> = [
    { key: 'assigned', moment: 'assignedAt', stage: 0 },
    ...FLOW.map((entry, index) => ({ key: entry.step as MissionMilestone['key'], moment: entry.doneAt, stage: index + 1 })),
  ];

  const steps = rows.map((row) => {
    const recorded = job[row.moment] ?? null;
    const done = position !== undefined ? position >= row.stage : Boolean(recorded);

    return { row, done, at: done ? recorded : null };
  });

  // The job waits on the first step it has not reached.
  const waitingOn = steps.find((step) => !step.done)?.row.stage;

  return steps.map(({ row, done, at }) => ({
    key: row.key,
    label: message(locale, `mission.milestones.${MILESTONE_KEYS[row.key]}`),
    at,
    done,
    // A job outside the mission (cancelled, in dispute, back in the queue) waits on no step of it.
    current: position !== undefined && row.stage === waitingOn,
  }));
}

/** An artisan's way of being reachable, in the words of one toggle. */
export type AvailabilityView = 'online' | 'busy' | 'offline';

export interface AvailabilityFields {
  availabilityStatus?: string | null;
  isAcceptingJobs?: boolean | null;
}

/**
 * What the toggle shows: "online" is being ONLINE and accepting jobs; BUSY is its own state (the server
 * sets it, the artisan cannot); anything else is offline.
 */
export function availabilityView(profile: AvailabilityFields | null | undefined): AvailabilityView {
  if (!profile) return 'offline';

  if (profile.availabilityStatus === 'BUSY') return 'busy';

  return profile.availabilityStatus === 'ONLINE' && profile.isAcceptingJobs === true ? 'online' : 'offline';
}

/** The words of the toggle in a language. */
export function availabilityLabels(locale: Locale = DEFAULT_LOCALE): Record<AvailabilityView, string> {
  return {
    online: message(locale, 'artisan.availability.online'),
    busy: message(locale, 'artisan.availability.busy'),
    offline: message(locale, 'artisan.availability.offline'),
  };
}

/** The words of the toggle in French. */
export const AVAILABILITY_LABELS: Record<AvailabilityView, string> = availabilityLabels('fr');
