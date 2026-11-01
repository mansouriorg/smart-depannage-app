import { message, routes, type ArtisanAvailabilityAnswer, type Locale, type RouteSpec } from '../lib/shared';

export type Wanted = 'online' | 'offline';

/** What happened to the position, once the artisan asked to go online or to refresh it. */
export type PositionOutcome = 'sent' | 'denied' | 'unavailable' | 'failed' | 'none';

export interface AvailabilityDeps {
  call: <Response>(route: RouteSpec<Response>) => Promise<Response>;
  /** The position of the phone; 'denied' when the person refused the permission, null when there is none to be had. */
  readPosition: () => Promise<{ latitude: number; longitude: number } | 'denied' | null>;
}

/** Sends the position. Never throws: a position that could not be sent is an outcome, not a failure of the toggle. */
export async function sendPosition(deps: AvailabilityDeps): Promise<PositionOutcome> {
  try {
    const point = await deps.readPosition();

    if (point === 'denied') return 'denied';
    if (!point) return 'unavailable';

    await deps.call(routes.artisans.location({ latitude: point.latitude, longitude: point.longitude }));

    return 'sent';
  } catch {
    return 'failed';
  }
}

/**
 * Goes online or offline for real: the server is told, and what it answers is what the screen shows.
 * Going online also sends the position, but a position that cannot be had does not stop the artisan from
 * being online (they are told, see `positionNotice`). Going offline never touches the GPS.
 * A failure of the call itself throws: the artisan is still in the state they were in.
 */
export async function switchAvailability(
  wanted: Wanted,
  deps: AvailabilityDeps,
): Promise<{ answer: ArtisanAvailabilityAnswer; position: PositionOutcome }> {
  if (wanted === 'offline') {
    return { answer: await deps.call(routes.artisans.goOffline()), position: 'none' };
  }

  const answer = await deps.call(routes.artisans.goOnline());

  return { answer, position: await sendPosition(deps) };
}

/** What to tell the artisan about their position, or null when there is nothing to say. */
export function positionNotice(outcome: PositionOutcome, locale: Locale): string | null {
  switch (outcome) {
    case 'denied':
      return message(locale, 'app.availability.notice.denied');
    case 'unavailable':
    case 'failed':
      return message(locale, 'app.availability.notice.failed');
    default:
      return null;
  }
}
