import { message, routes, type ArtisanIntervention, type BoardIntervention, type Locale, type MissionRejectionReason, type MissionStep, type RouteSpec } from '../lib/shared';

/** The steps that are a plain call. The last one, `complete`, is closed with a photo (see ProofOfWorkCamera). */
export type PlainStep = Exclude<MissionStep, 'complete'>;

/** The call that does a step of a mission. */
export function stepRoute(step: PlainStep, id: number | string): RouteSpec<ArtisanIntervention> {
  switch (step) {
    case 'accept':
      return routes.artisans.accept(id);
    case 'on-the-way':
      return routes.artisans.onTheWay(id);
    case 'arrived':
      return routes.artisans.arrived(id);
    case 'start':
      return routes.artisans.start(id);
  }
}

/** What the artisan is told when a step failed and the server gave no sentence of its own. */
export function stepFailure(step: PlainStep, locale: Locale): string {
  switch (step) {
    case 'accept':
      return message(locale, 'app.mission.stepFailed.accept');
    case 'on-the-way':
      return message(locale, 'app.mission.stepFailed.onTheWay');
    case 'arrived':
      return message(locale, 'app.mission.stepFailed.arrived');
    case 'start':
      return message(locale, 'app.mission.stepFailed.start');
  }
}

/**
 * GET /interventions/:id answers with the artisan's own copy of a job that is theirs, and with the board's copy (no
 * client, no moments) of a job nobody holds. Only the first is a mission of this artisan.
 */
export function isOwnMission(job: ArtisanIntervention | BoardIntervention | null | undefined): job is ArtisanIntervention {
  return Boolean(job) && 'artisanId' in (job as object) && (job as ArtisanIntervention).artisanId !== null;
}

/**
 * The job after a step: the answer of the server is the job as it is now, so its fields replace the old ones; the
 * lists the answer does not bring (the chats, the timeline) stay as they were.
 */
export function withAnswer(job: ArtisanIntervention, answer: Partial<ArtisanIntervention> | null | undefined): ArtisanIntervention {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return job;

  return { ...job, ...answer };
}

/** The sentence under the status: what the job waits for. */
export function waitingFor(status: string | null | undefined, locale: Locale): string | null {
  switch (status) {
    case 'ASSIGNED':
      return message(locale, 'app.mission.waiting.assigned');
    case 'ARTISAN_ACCEPTED':
    case 'ACCEPTED':
      return message(locale, 'app.mission.waiting.accepted');
    case 'ARTISAN_ON_THE_WAY':
    case 'ON_THE_WAY':
      return message(locale, 'app.mission.waiting.onTheWay');
    case 'ARTISAN_ARRIVED':
    case 'ARRIVED':
      return message(locale, 'app.mission.waiting.arrived');
    case 'IN_PROGRESS':
      return message(locale, 'app.mission.waiting.inProgress');
    case 'WAITING_CLIENT_VALIDATION':
    case 'COMPLETED':
    case 'PAYMENT_PENDING':
    case 'PAID':
    case 'INVOICE_READY':
    case 'INVOICE_SENT':
      return message(locale, 'app.mission.waiting.done');
    case 'CANCELLED':
      return message(locale, 'app.mission.waiting.cancelled');
    case 'DISPUTED':
      return message(locale, 'app.mission.waiting.disputed');
    default:
      return null;
  }
}

/** "Other" is the one reason that says nothing by itself: the artisan has to say what it is. */
export function declineIsReady(reason: MissionRejectionReason | null, note: string): boolean {
  if (!reason) return false;

  return reason !== 'OTHER' || note.trim().length >= 3;
}

/** The body of a refusal: the note is left out when there is none (the server takes it as optional). */
export function declineBody(reason: MissionRejectionReason, note: string): { reason: MissionRejectionReason; note?: string } {
  const text = note.trim();

  return text ? { reason, note: text } : { reason };
}
