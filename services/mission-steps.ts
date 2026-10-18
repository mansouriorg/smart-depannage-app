import { routes, type ArtisanIntervention, type BoardIntervention, type MissionRejectionReason, type MissionStep, type RouteSpec } from '../lib/shared';

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
export const STEP_FAILURE: Record<PlainStep, string> = {
  accept: 'La mission n’a pas pu être acceptée. Réessayez.',
  'on-the-way': 'Le départ n’a pas pu être enregistré. Réessayez.',
  arrived: 'L’arrivée n’a pas pu être enregistrée. Réessayez.',
  start: 'Le début des travaux n’a pas pu être enregistré. Réessayez.',
};

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
export function waitingFor(status: string | null | undefined): string | null {
  switch (status) {
    case 'ASSIGNED':
      return 'Cette mission vous a été assignée. Acceptez-la ou refusez-la.';
    case 'ARTISAN_ACCEPTED':
    case 'ACCEPTED':
      return 'Mission acceptée. Partez vers le client quand vous êtes prêt.';
    case 'ARTISAN_ON_THE_WAY':
    case 'ON_THE_WAY':
      return 'Le client sait que vous êtes en route.';
    case 'ARTISAN_ARRIVED':
    case 'ARRIVED':
      return 'Vous êtes sur place. Commencez les travaux.';
    case 'IN_PROGRESS':
      return 'Travaux en cours. Terminez avec une photo de preuve.';
    case 'WAITING_CLIENT_VALIDATION':
    case 'COMPLETED':
    case 'PAYMENT_PENDING':
    case 'PAID':
    case 'INVOICE_READY':
    case 'INVOICE_SENT':
      return 'Mission terminée.';
    case 'CANCELLED':
      return 'Cette mission a été annulée.';
    case 'DISPUTED':
      return 'Cette mission est en litige : l’équipe vous contactera.';
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
