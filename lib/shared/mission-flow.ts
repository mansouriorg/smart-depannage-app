import type { MissionRejectionReason } from './generated/enums';
import { CanonicalStatus, canonicalStatus, checkTransition } from './generated/intervention-status';

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

export const MISSION_FLOW: readonly MissionStepInfo[] = [
  { step: 'accept', from: 'ASSIGNED', to: 'ARTISAN_ACCEPTED', label: 'Accepter la mission', busyLabel: 'Acceptation…', doneAt: 'artisanAcceptedAt', needsProof: false },
  { step: 'on-the-way', from: 'ARTISAN_ACCEPTED', to: 'ARTISAN_ON_THE_WAY', label: 'Je suis en route', busyLabel: 'Envoi…', doneAt: 'artisanOnTheWayAt', needsProof: false },
  { step: 'arrived', from: 'ARTISAN_ON_THE_WAY', to: 'ARTISAN_ARRIVED', label: 'Je suis arrivé', busyLabel: 'Envoi…', doneAt: 'artisanArrivedAt', needsProof: false },
  { step: 'start', from: 'ARTISAN_ARRIVED', to: 'IN_PROGRESS', label: 'Commencer les travaux', busyLabel: 'Démarrage…', doneAt: 'workStartedAt', needsProof: false },
  { step: 'complete', from: 'IN_PROGRESS', to: 'COMPLETED', label: 'Terminer avec une photo', busyLabel: 'Envoi de la photo…', doneAt: 'workCompletedAt', needsProof: true },
];

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
): MissionStepInfo | null {
  const current = canonicalStatus(status);

  if (!current) return null;

  const step = MISSION_FLOW.find((entry) => entry.from === current);

  if (!step) return null;

  // The server's table has the last word: a step it no longer allows an artisan is not offered.
  return allowed(current, step.to) ? step : null;
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
export function missionRefusal(status: string | null | undefined): MissionRefusal | null {
  const current = canonicalStatus(status);

  if (!current) return null;

  // (A job that already waits in the queue has nothing to hand back: "same status" is not a way back.)
  if (current === 'WAITING_ADMIN_REVIEW' || !checkTransition(current, 'WAITING_ADMIN_REVIEW', 'artisan').ok) {
    return null;
  }

  return current === 'ASSIGNED'
    ? { label: 'Refuser la mission', question: 'Pourquoi refusez-vous cette mission ?' }
    : { label: 'Rendre la mission', question: 'Pourquoi rendez-vous cette mission ?' };
}

/** The reasons an artisan can give for a refusal, as the server knows them, with their words. */
export const DECLINE_REASONS: ReadonlyArray<{ value: MissionRejectionReason; label: string }> = [
  { value: 'NOT_AVAILABLE', label: 'Je ne suis pas disponible' },
  { value: 'TOO_FAR', label: 'C’est trop loin' },
  { value: 'OUT_OF_SPECIALTY', label: 'Ce n’est pas ma spécialité' },
  { value: 'PRICE_TOO_LOW', label: 'Le prix est trop bas' },
  { value: 'OTHER', label: 'Autre raison' },
];

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

const MILESTONE_LABELS: Record<MissionMilestone['key'], string> = {
  assigned: 'Mission assignée',
  accept: 'Mission acceptée',
  'on-the-way': 'En route vers le client',
  arrived: 'Arrivé chez le client',
  start: 'Travaux commencés',
  complete: 'Travaux terminés',
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

export const MISSION_BUCKETS: ReadonlyArray<{ id: MissionBucket; label: string }> = [
  { id: 'todo', label: 'À accepter' },
  { id: 'active', label: 'En cours' },
  { id: 'done', label: 'Terminées' },
];

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
export function missionTimeline(job: MissionMoments): MissionMilestone[] {
  const current = canonicalStatus(job.status);
  const position = current ? STAGE_OF_STATUS[current] : undefined;

  const rows: Array<{ key: MissionMilestone['key']; moment: MissionMoment; stage: number }> = [
    { key: 'assigned', moment: 'assignedAt', stage: 0 },
    ...MISSION_FLOW.map((entry, index) => ({ key: entry.step as MissionMilestone['key'], moment: entry.doneAt, stage: index + 1 })),
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
    label: MILESTONE_LABELS[row.key],
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

export const AVAILABILITY_LABELS: Record<AvailabilityView, string> = {
  online: 'En ligne',
  busy: 'Occupé',
  offline: 'Hors ligne',
};
