import { DEFAULT_LOCALE, type Locale } from './generated/i18n';
import { canonicalStatus } from './generated/intervention-status';
import { message } from './i18n';
import type { StatusTone } from './status';

/**
 * Where the technician is, and how much that can be trusted (P3-05).
 *
 * The server keeps the last position of a technician with the time the phone sent it, and tells three things about it:
 *
 *   - `fresh`: news within the silence limit (10 minutes unless the owner set another);
 *   - `stale`: no news for the limit or longer;
 *   - `unknown`: nobody knows when it was sent (a position from before the time was kept, or none at all).
 *
 * The customer is told when the technician will be there only from a fresh position. The dispatcher sees the state next to the
 * technician, and can replay the route of a job when there is a dispute. The words for the customer are in the catalogue (French and
 * Arabic); the dashboard stays French, like `finance.ts` and `complaints.ts`.
 */

export type PositionState = 'fresh' | 'stale' | 'unknown';

/** `no-destination`: the job has no point on the map, so there is nothing to measure to. */
export type ArrivalState = PositionState | 'no-destination';

/** What the server adds next to a job that is on the way (`arrival`): absent at every other stage. */
export interface Arrival {
  state: ArrivalState;
  /** Minutes until the technician is there; only from a fresh position and a job with a point on the map. */
  minutes: number | null;
  /** How old the position is, in whole minutes; null when it is not known. */
  ageMinutes: number | null;
}

/** A job (or the tracking page of one) with the arrival the server may add. */
export type WithArrival<Job> = Job & { arrival?: Arrival };

// ----------------------------------------------------------
// What the customer reads
// ----------------------------------------------------------

export type ArrivalKind = 'minutes' | 'soon' | 'far' | 'stale' | 'unknown';

export interface ArrivalNotice {
  kind: ArrivalKind;
  /** The heading of the block: "Arrivée estimée". */
  title: string;
  /** The sentence: "Votre technicien arrive dans environ 12 minutes." */
  headline: string;
  /** How old the position it is worked out from, only when there is an arrival time to qualify. */
  detail: string | null;
  /** That it is an estimate, only when there is an arrival time. */
  note: string | null;
  /** The minutes behind the sentence, for a screen that wants to show the figure itself. */
  minutes: number | null;
}

/** At or under this many minutes the sentence is "in a moment" instead of a figure the estimate cannot honour. */
export const ARRIVAL_SOON_MINUTES = 2;

/** From this many minutes the sentence is "in more than an hour": a figure that large is not worth the false precision. */
export const ARRIVAL_FAR_MINUTES = 60;

/** "Position reçue il y a 3 min", or "à l’instant" for a position under a minute old; null when the age is not known. */
export function positionAgeText(ageMinutes: number | null | undefined, locale: Locale = DEFAULT_LOCALE): string | null {
  if (typeof ageMinutes !== 'number' || !Number.isFinite(ageMinutes) || ageMinutes < 0) return null;

  const minutes = Math.floor(ageMinutes);

  return minutes === 0 ? message(locale, 'tracking.arrival.justNow') : message(locale, 'tracking.arrival.age', { minutes });
}

/**
 * What the page says about the arrival, or null when it says nothing: the job is not on the way (the server sends no `arrival`), or it has
 * no point on the map (most requests made on the website have none, and "cannot be calculated" on every one of them would be noise).
 */
export function arrivalNotice(arrival: Arrival | null | undefined, locale: Locale = DEFAULT_LOCALE): ArrivalNotice | null {
  if (!arrival || arrival.state === 'no-destination') return null;

  const minutes = typeof arrival.minutes === 'number' && Number.isFinite(arrival.minutes) && arrival.minutes > 0 ? Math.round(arrival.minutes) : null;

  if (arrival.state === 'fresh' && minutes !== null) {
    const kind: ArrivalKind = minutes <= ARRIVAL_SOON_MINUTES ? 'soon' : minutes >= ARRIVAL_FAR_MINUTES ? 'far' : 'minutes';
    const headline =
      kind === 'soon'
        ? message(locale, 'tracking.arrival.soon')
        : kind === 'far'
          ? message(locale, 'tracking.arrival.far')
          : message(locale, 'tracking.arrival.minutes', { minutes });

    return {
      kind,
      title: message(locale, 'tracking.arrival.title'),
      headline,
      detail: positionAgeText(arrival.ageMinutes, locale),
      note: message(locale, 'tracking.arrival.note'),
      minutes,
    };
  }

  // Fresh, but with no minutes (it cannot be measured), is told as unknown: nobody is given a figure that is not there.
  const title = message(locale, 'tracking.arrival.title');

  if (arrival.state === 'stale') return { kind: 'stale', title, headline: message(locale, 'tracking.arrival.stale'), detail: null, note: null, minutes: null };

  return { kind: 'unknown', title, headline: message(locale, 'tracking.arrival.unknown'), detail: null, note: null, minutes: null };
}

/** After this many failed tries in a row the page says it lost contact, and it stops showing an arrival time it can no longer vouch for. */
export const ARRIVAL_HIDDEN_AFTER_FAILURES = 2;

/**
 * An answer older than this is no longer told as the arrival time. The page asks again every 20 seconds while it is in front, so an answer this
 * old means it was not asking (the tab was hidden or frozen, the phone was asleep): the figure was true then, not now.
 */
export const ARRIVAL_ANSWER_MAX_AGE_MS = 120_000;

/**
 * What the tracking page shows: the arrival of the answer it holds, but only while the job is on the way (a job that has moved on must not
 * keep the last estimate), only while the page is in contact with the server, and only while the answer is recent (`answeredAt` and `now`,
 * in milliseconds; an answer whose time is not known is taken as recent).
 */
export function visibleArrival(
  job: { status?: string | null; arrival?: Arrival | null },
  options: { failures?: number; locale?: Locale; answeredAt?: number | null; now?: number } = {},
): ArrivalNotice | null {
  if (canonicalStatus(job.status) !== 'ARTISAN_ON_THE_WAY') return null;
  if ((options.failures ?? 0) >= ARRIVAL_HIDDEN_AFTER_FAILURES) return null;
  const heldMs = typeof options.answeredAt === 'number' && typeof options.now === 'number' ? options.now - options.answeredAt : 0;

  if (heldMs > ARRIVAL_ANSWER_MAX_AGE_MS) return null;

  // The age in the answer is the age at the moment it was given: the minutes the page has held it since are added, so that "reçue il y a 9 min"
  // does not stay on the screen for two more minutes.
  const sinceAnswer = Math.floor(Math.max(0, heldMs) / 60_000);
  const arrival = job.arrival && sinceAnswer > 0 && typeof job.arrival.ageMinutes === 'number' ? { ...job.arrival, ageMinutes: job.arrival.ageMinutes + sinceAnswer } : job.arrival;

  return arrivalNotice(arrival, options.locale ?? DEFAULT_LOCALE);
}

// ----------------------------------------------------------
// What the dispatcher reads (French: the dashboard)
// ----------------------------------------------------------

export interface PositionFlag {
  state: PositionState;
  label: string;
  /** How long ago, for a position that is fresh or stale. */
  detail: string | null;
  tone: StatusTone;
}

/** "25 min", "2 h 05", "2 j 3 h". Only for a position that is stale or at least a minute old: under a minute the flag says "à l’instant" itself. */
function agoText(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  // From two days a count of hours is hard to read ("50 h"): days and hours.
  if (hours >= 48) {
    const days = Math.floor(hours / 24);
    const hoursLeft = hours % 24;

    return hoursLeft === 0 ? `${days} j` : `${days} j ${hoursLeft} h`;
  }

  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

/** The flag next to a technician: whether their position can be trusted, and how old it is. */
export function positionFlag(state: PositionState | string | null | undefined, ageMinutes: number | null | undefined): PositionFlag {
  const age = typeof ageMinutes === 'number' && Number.isFinite(ageMinutes) && ageMinutes >= 0 ? Math.floor(ageMinutes) : null;

  if (state === 'fresh' && age !== null) {
    return { state: 'fresh', label: 'Position à jour', detail: age < 1 ? 'à l’instant' : `il y a ${agoText(age)}`, tone: 'success' };
  }

  if (state === 'stale' && age !== null) {
    return { state: 'stale', label: 'Sans nouvelles', detail: `depuis ${agoText(age)}`, tone: 'warning' };
  }

  // Never sent, sent before the time was kept, or a state this copy does not know: the dispatcher is told the position cannot be dated.
  return { state: 'unknown', label: 'Position non datée', detail: null, tone: 'waiting' };
}

/** What `GET /admin/artisans/:profileId/location` answers. */
export interface ArtisanLocationRead {
  artisanProfileId: number;
  userId: number;
  latitude: number | null;
  longitude: number | null;
  /** When the phone sent the position (ISO); null when it is not known. */
  positionAt: string | null;
  locationState: PositionState;
  locationAgeMinutes: number | null;
  /** The last sign of life of any kind (the online switch counts): not the age of the position. */
  lastSeenAt: string | null;
  availabilityStatus: string | null;
  isAcceptingJobs: boolean;
}

// ----------------------------------------------------------
// The route of a job (the dashboard, for a dispute)
// ----------------------------------------------------------

export type RouteMomentType = 'ARTISAN_ON_THE_WAY' | 'ARTISAN_ARRIVED' | 'WORK_STARTED' | 'WORK_COMPLETED';

export interface RoutePoint {
  at: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  speedMps: number | null;
  heading: number | null;
}

export interface RouteMoment {
  type: RouteMomentType;
  at: string;
}

/** A technician other than the one drawn who also sent positions on the job (it changed hands). */
export interface RouteOther {
  artisan: { id: number; name: string };
  pointCount: number;
  firstAt: string;
  lastAt: string;
}

/** What `GET /admin/interventions/:id/route` answers (dates are ISO texts: the answer came through JSON). */
export interface JobRoute {
  interventionId: number;
  /** Whose route this is; `current` is true when they hold the job now (only then do the moments below belong to them). */
  artisan: { id: number; name: string; current: boolean } | null;
  /** The other technicians who sent positions on this job, none of them in `points`; `?artisanId=` reads one. */
  others: RouteOther[];
  destination: { latitude: number; longitude: number; address: string | null } | null;
  points: RoutePoint[];
  moments: RouteMoment[];
  summary: {
    pointCount: number;
    firstAt: string | null;
    lastAt: string | null;
    /** Length of the line through the positions, in km. */
    pathKm: number;
    /** The nearest the technician came to the address (metres) and when. */
    closest: { meters: number; at: string } | null;
    /** How far from the address the position nearest in time to "arrived" was (metres), within five minutes of it. */
    atArrival: { meters: number; at: string; arrivedAt: string } | null;
  };
  /** Days positions are kept (the setting in force now). */
  historyDays: number;
  /** True when the technician set out longer ago than the history is kept: the first positions may be gone. */
  mayBeIncomplete: boolean;
  /** True when the answer stops at the most positions it carries: the latest are not in it. */
  cut: boolean;
}

/** The positions a route answer carries at most (the server's limit, repeated for the note). */
export const ROUTE_POINT_LIMIT = 2000;

const MOMENT_WORDS: Record<RouteMomentType, string> = {
  ARTISAN_ON_THE_WAY: 'Parti en route',
  ARTISAN_ARRIVED: 'Arrivé sur place',
  WORK_STARTED: 'Début des travaux',
  WORK_COMPLETED: 'Fin des travaux',
};

/** The words of a moment of the job; a type this copy does not know is not shown as a raw code. */
export function momentLabel(type: string): string {
  return (MOMENT_WORDS as Record<string, string>)[type] ?? 'Étape de l’intervention';
}

const CLOCK = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Tunis', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const CLOCK_SECONDS = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Tunis', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const DAY = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Tunis', day: '2-digit', month: '2-digit', year: 'numeric' });

function validTime(iso: string | null | undefined): Date | null {
  if (!iso) return null;

  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? null : date;
}

/** "10:41" in Tunis time; an empty text for a time that is not one. */
export function clockText(iso: string | null | undefined, withSeconds = false): string {
  const date = validTime(iso);

  return date ? (withSeconds ? CLOCK_SECONDS : CLOCK).format(date) : '';
}

/** "01/11/2026 10:41" in Tunis time. */
export function dayClockText(iso: string | null | undefined, withSeconds = false): string {
  const date = validTime(iso);

  return date ? `${DAY.format(date)} ${(withSeconds ? CLOCK_SECONDS : CLOCK).format(date)}` : '';
}

/** True when the route does not start and end on the same day (Tunis time): then every time is written with its date. */
export function spansDays(route: Pick<JobRoute, 'points' | 'moments'>): boolean {
  const days = new Set<string>();

  for (const iso of [route.points[0]?.at, route.points[route.points.length - 1]?.at, ...route.moments.map((moment) => moment.at)]) {
    const date = validTime(iso);

    if (date) days.add(DAY.format(date));
  }

  return days.size > 1;
}

/** "850 m", "5,2 km". */
export function distanceText(meters: number | null | undefined): string {
  if (typeof meters !== 'number' || !Number.isFinite(meters) || meters < 0) return '';

  // 999.6 m is "1,0 km", not "1000 m": the metres are rounded first.
  if (Math.round(meters) < 1000) return `${Math.round(meters)} m`;

  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

/** "1 jour", "7 jours". */
function daysText(days: number): string {
  return `${days} jour${days > 1 ? 's' : ''}`;
}

export interface RouteFact {
  label: string;
  value: string;
}

/** The answers a dispute asks first, as lines of a table. */
export function routeFacts(route: JobRoute): RouteFact[] {
  const { summary } = route;
  const facts: RouteFact[] = [];

  if (summary.pointCount === 0) return facts;

  // A route that crosses midnight is written with its dates: "de 00:50 à 09:10" would read as a route of nine hours on the same day.
  const withDay = spansDays(route);
  const time = (iso: string) => (withDay ? dayClockText(iso) : clockText(iso));

  facts.push({
    label: 'Positions enregistrées',
    value: `${summary.pointCount}${summary.firstAt && summary.lastAt ? (withDay ? ` (du ${time(summary.firstAt)} au ${time(summary.lastAt)})` : ` (de ${time(summary.firstAt)} à ${time(summary.lastAt)})`) : ''}`,
  });
  facts.push({ label: 'Longueur du parcours', value: distanceText(summary.pathKm * 1000) });

  if (route.destination) {
    facts.push({
      label: 'Au plus près de l’adresse',
      value: summary.closest ? `${distanceText(summary.closest.meters)} ${withDay ? 'le' : 'à'} ${time(summary.closest.at)}` : 'Non mesuré',
    });
  }

  const arrived = route.moments.find((moment) => moment.type === 'ARTISAN_ARRIVED');

  if (arrived && route.destination) {
    facts.push({
      label: 'À l’arrivée déclarée',
      value: summary.atArrival
        ? `${distanceText(summary.atArrival.meters)} de l’adresse (position de ${time(summary.atArrival.at)}, arrivée déclarée à ${time(arrived.at)})`
        : `Aucune position dans les 5 minutes de l’arrivée déclarée (${time(arrived.at)})`,
    });
  }

  return facts;
}

/** What the reader must keep in mind before they conclude anything from the route. */
export function routeNotes(route: JobRoute): string[] {
  const notes: string[] = [];

  if (route.summary.pointCount === 0) {
    notes.push(
      `Aucune position enregistrée pour cette intervention : le téléphone du technicien n’a pas envoyé sa position pendant le trajet, ou elles ont été supprimées (elles sont gardées ${daysText(route.historyDays)}, plus longtemps tant qu’une réclamation est ouverte).`,
    );
  }

  if (route.artisan && !route.artisan.current) {
    notes.push(`${route.artisan.name || 'Ce technicien'} n’est plus le technicien de cette intervention : les étapes (départ, arrivée, travaux) sont celles du technicien actuel et ne sont pas montrées ici.`);
  }

  for (const other of route.others ?? []) {
    notes.push(
      `${other.artisan.name || 'Un autre technicien'} a aussi envoyé ${other.pointCount} position${other.pointCount > 1 ? 's' : ''} sur cette intervention (${dayClockText(other.firstAt)}${other.firstAt === other.lastAt ? '' : ` → ${dayClockText(other.lastAt)}`}) : ${other.pointCount > 1 ? 'elles ne sont pas dans ce tracé' : 'elle n’est pas dans ce tracé'}.`,
    );
  }

  if (!route.destination) {
    notes.push('L’adresse de cette intervention n’a pas de point sur la carte : les distances à l’adresse ne sont pas calculées.');
  }

  if (route.mayBeIncomplete) {
    notes.push(`Ce trajet date de plus de ${daysText(route.historyDays)} : les premières positions ont pu être supprimées.`);
  }

  if (route.cut) {
    notes.push(
      `Le trajet compte plus de ${ROUTE_POINT_LIMIT} positions : seules les ${ROUTE_POINT_LIMIT} premières sont montrées, et la longueur, le point le plus proche et l’arrivée déclarée ne portent que sur celles-ci.`,
    );
  }

  if (route.summary.pointCount > 0) {
    notes.push('Un téléphone n’envoie sa position que lorsque l’application est ouverte : un trou dans le tracé peut être une application fermée, pas un arrêt.');
  }

  return notes;
}

// ----------------------------------------------------------
// Drawing the route
// ----------------------------------------------------------

export interface DrawnPoint {
  x: number;
  y: number;
  at: string;
}

export interface RouteDrawing {
  width: number;
  height: number;
  points: DrawnPoint[];
  /** `x,y x,y …` for the `points` attribute of a polyline. */
  line: string;
  destination: { x: number; y: number } | null;
  /** A length on the drawing and the distance it stands for. */
  scale: { length: number; meters: number; label: string } | null;
}

const NICE_METERS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];

/**
 * The route as coordinates in a box, north up, one metre the same size in both directions (the longitude is shortened by the cosine of the
 * latitude, which is exact enough over the few kilometres of a job). A route of one point, or of points on top of each other, is centred.
 */
export function drawRoute(route: Pick<JobRoute, 'points' | 'destination'>, width = 600, height = 360, padding = 24): RouteDrawing {
  const coordinates = [...route.points.map((point) => ({ latitude: point.latitude, longitude: point.longitude })), ...(route.destination ? [route.destination] : [])];

  if (coordinates.length === 0) return { width, height, points: [], line: '', destination: null, scale: null };

  const midLatitude = coordinates.reduce((sum, c) => sum + c.latitude, 0) / coordinates.length;
  const midLongitude = coordinates.reduce((sum, c) => sum + c.longitude, 0) / coordinates.length;
  const metersPerDegreeLat = 110_540;
  const metersPerDegreeLng = 111_320 * Math.cos((midLatitude * Math.PI) / 180);
  const east = (longitude: number) => (longitude - midLongitude) * metersPerDegreeLng;
  const north = (latitude: number) => (latitude - midLatitude) * metersPerDegreeLat;

  const xs = coordinates.map((c) => east(c.longitude));
  const ys = coordinates.map((c) => north(c.latitude));
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  const innerWidth = Math.max(1, width - 2 * padding);
  const innerHeight = Math.max(1, height - 2 * padding);
  // Pixels per metre: the span that fills its side first decides; with no span at all (one place) the box is 200 m across.
  const perMeter = Math.min(innerWidth / Math.max(spanX, 1), innerHeight / Math.max(spanY, 1), innerWidth / 200);
  const centerX = (Math.max(...xs) + Math.min(...xs)) / 2;
  const centerY = (Math.max(...ys) + Math.min(...ys)) / 2;
  const toX = (longitude: number) => round(width / 2 + (east(longitude) - centerX) * perMeter);
  const toY = (latitude: number) => round(height / 2 - (north(latitude) - centerY) * perMeter);

  const points = route.points.map((point) => ({ x: toX(point.longitude), y: toY(point.latitude), at: point.at }));
  const wanted = (width * 0.3) / perMeter;
  const meters = NICE_METERS.filter((value) => value <= wanted).pop() ?? NICE_METERS[0];

  return {
    width,
    height,
    points,
    line: points.map((point) => `${point.x},${point.y}`).join(' '),
    destination: route.destination ? { x: toX(route.destination.longitude), y: toY(route.destination.latitude) } : null,
    scale: { length: round(meters * perMeter), meters, label: meters >= 1000 ? `${meters / 1000} km` : `${meters} m` },
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

// ----------------------------------------------------------
// Replaying it
// ----------------------------------------------------------

export interface ReplayFrame {
  index: number;
  point: RoutePoint | null;
  /** "+12 min 30 s" from the first position, or an empty text before there is one. */
  elapsed: string;
  /** The moments of the job that had happened by this position (all of them at the last one, which is where the replay ends). */
  moments: RouteMoment[];
}

/** What the replay shows at one position: where, how long after the start, and which moments had passed. */
export function replayFrame(route: Pick<JobRoute, 'points' | 'moments'>, index: number): ReplayFrame {
  if (route.points.length === 0) return { index: 0, point: null, elapsed: '', moments: [] };

  const at = Math.min(Math.max(0, Math.floor(Number.isFinite(index) ? index : 0)), route.points.length - 1);
  const point = route.points[at];
  const start = validTime(route.points[0].at);
  const now = validTime(point.at);
  let elapsed = '';

  if (start && now) {
    const seconds = Math.max(0, Math.round((now.getTime() - start.getTime()) / 1000));
    const minutes = Math.floor(seconds / 60);
    const rest = String(seconds % 60).padStart(2, '0');

    // Over an hour: "+8 h 20 min 00 s", not "+500 min 00 s".
    elapsed = minutes >= 60 ? `+${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min ${rest} s` : `+${minutes} min ${rest} s`;
  }

  return {
    index: at,
    point,
    elapsed,
    // At the last position nothing more can be shown: a moment after it (the end of the work, after the app closed) has happened by then.
    moments: route.moments.filter((moment) => {
      const happened = validTime(moment.at);

      return happened !== null && now !== null && (at === route.points.length - 1 || happened.getTime() <= now.getTime());
    }),
  };
}

// ----------------------------------------------------------
// What one position of the replay says
// ----------------------------------------------------------

const EARTH_RADIUS_METERS = 6_371_000;

/** The distance between two places on the earth, in metres (the great circle). */
export function metersBetween(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(to.latitude - from.latitude);
  const dLng = radians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** "29 km/h" from metres per second, or a dash when the phone did not say. */
export function speedText(metersPerSecond: number | null | undefined): string {
  if (typeof metersPerSecond !== 'number' || !Number.isFinite(metersPerSecond) || metersPerSecond < 0) return '—';

  return `${Math.round(metersPerSecond * 3.6)} km/h`;
}

/** "± 8 m": how far off the phone says it may be, or a dash. */
export function accuracyText(meters: number | null | undefined): string {
  if (typeof meters !== 'number' || !Number.isFinite(meters) || meters < 0) return '—';

  return `± ${Math.round(meters)} m`;
}

/** A time of the route as the reader should see it: the clock, and the date as well when the route crosses midnight. */
export function routeClock(route: Pick<JobRoute, 'points' | 'moments'>, iso: string | null | undefined): string {
  return spansDays(route) ? dayClockText(iso) : clockText(iso);
}

/** The lines under the drawing for the position that is shown: when, how long after the start, how fast, how sure, how far from the address. */
export function replayDetails(route: Pick<JobRoute, 'points' | 'moments' | 'destination'>, index: number): RouteFact[] {
  const frame = replayFrame(route, index);

  if (!frame.point) return [];

  const details: RouteFact[] = [
    { label: 'Heure', value: spansDays(route) ? dayClockText(frame.point.at, true) : clockText(frame.point.at, true) },
    { label: 'Depuis la première position', value: frame.elapsed },
    { label: 'Vitesse', value: speedText(frame.point.speedMps) },
    { label: 'Précision', value: accuracyText(frame.point.accuracyMeters) },
  ];

  if (route.destination) {
    details.push({ label: 'Distance de l’adresse', value: distanceText(metersBetween(frame.point, route.destination)) });
  }

  return details;
}
