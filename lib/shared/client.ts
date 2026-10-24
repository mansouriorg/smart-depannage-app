import type { OffsetPaginated, Paginated } from './generated/envelope';
import type { DispatchSort, DispatchViewId } from './generated/intervention-status';
import type { ArtisanAvailabilityAnswer, ArtisanSelf, MissionRefusalAnswer } from './artisan';
import type { MissionRejectionReason } from './generated/enums';
import type { ArtisanIntervention, ArtisanInterventionQuote, BoardIntervention, ClientIntervention, TrackingIntervention, TrackingInterventionQuote } from './generated/views';
import type { CashPosition, CollectCashAnswer, CollectCashBody, LedgerPage, LedgerQuery } from './cash';
import type { QuoteBody } from './quote-builder';
import type { GuestPaymentAnswer, GuestPaymentBody, GuestQuoteBody, PaymentOptions } from './customer';
import type { BotChallenge } from './bot-check';
import type {
  GuestCreated,
  GuestFeedbackBody,
  GuestPhotosAnswer,
  GuestProblemAnswer,
  GuestProblemBody,
  GuestRequestBody,
  PublicCategory,
} from './guest';

/**
 * The routes the apps call, with the type of what each answers.
 *
 * A route is a description: `routes.interventions.track(12, token)` says "GET /interventions/track/12
 * with ?token=" and carries the type of the answer, `TrackingIntervention`. `callApi(send, route)`
 * makes the call and gives that type back, so the screen that reads a field the server no longer
 * sends stops compiling after the types are generated again. The answers are not checked while the
 * app runs: the server is trusted to send what its views say (src/common/views/views.ts there).
 */

export type HttpMethod = 'get' | 'post' | 'patch' | 'put' | 'delete';

export interface RouteSpec<Response> {
  readonly method: HttpMethod;
  readonly url: string;
  readonly params?: Readonly<Record<string, string | number | boolean | undefined>>;
  readonly body?: unknown;
  /** Never set: it only carries the type of the answer. */
  readonly response?: Response;
}

export interface RequestConfig {
  method: string;
  url: string;
  params?: unknown;
  data?: unknown;
}

/** What `callApi` needs from the HTTP library: send this, give back an object with `data`. With axios: `(config) => api.request(config)`. */
export type Send = (config: RequestConfig) => Promise<{ data: unknown }>;

export async function callApi<Response>(send: Send, route: RouteSpec<Response>): Promise<Response> {
  const answer = await send({ method: route.method, url: route.url, params: route.params, data: route.body });

  return answer.data as Response;
}

function route<Response>(method: HttpMethod, url: string, extra: Pick<RouteSpec<Response>, 'params' | 'body'> = {}): RouteSpec<Response> {
  return { method, url, ...extra };
}

/** The proofs of work, as the back office reads them (the admin dashboard defines the row). */
export interface ProofListQuery {
  interventionId?: number | string;
  status?: string;
  kind?: 'BEFORE' | 'AFTER';
  take?: number;
  skip?: number;
}

/** What GET /users/artisans reads (the dashboard's list of technicians, and who a job can be given to). */
export interface ArtisanListQuery {
  page?: number;
  limit?: number;
  search?: string;
  /** Only the artisans a job can be given to: approved and active. */
  assignable?: boolean;
}

/**
 * What GET /admin/interventions reads: the dispatcher's list, a page at a time (P1-13). `view` is a tab
 * (a group of statuses), `status` one status in either spelling; `sort` is `queue` (most urgent first,
 * then the longest waiting), `newest` (the default) or `oldest`; `search` is a job number, a name, a
 * phone, an e-mail or a piece of the address.
 */
export interface InterventionListQuery {
  page?: number;
  limit?: number;
  view?: DispatchViewId;
  status?: string;
  urgency?: 'NORMAL' | 'URGENT' | 'EMERGENCY';
  serviceType?: string;
  search?: string;
  sort?: DispatchSort;
}

/** What GET /matching/admin/interventions/:id/artisans reads: who could take this job. */
export interface MatchQuery {
  /** Only the artisans who are free (no hard obstacle): the ones a job can be given to now. */
  onlyAvailable?: boolean;
  limit?: number;
}

/** What POST /notifications/push-tokens takes: the token of this phone, and what it is (all optional but the token). */
export interface PushTokenBody {
  token: string;
  platform?: string;
  deviceId?: string;
  deviceName?: string;
}

export const routes = {
  interventions: {
    /** The jobs of the signed-in artisan, in the artisan's copy. */
    assigned: () => route<ArtisanIntervention[]>('get', '/interventions/assigned'),
    /** The tracking page of a visitor: the job, with the link's token. */
    track: (id: number | string, token: string) => route<TrackingIntervention>('get', `/interventions/track/${id}`, { params: { token } }),
  },
  catalog: {
    /** The public catalog: every active category with its active sub-services (no sign-in). */
    all: () => route<PublicCategory[]>('get', '/services'),
  },
  quotes: {
    /** Makes a quote on a mission of the signed-in artisan and sends it to the customer in the same call (P2-05). */
    create: (interventionId: number | string, body: QuoteBody) => route<ArtisanInterventionQuote>('post', `/quotes/interventions/${interventionId}`, { body }),
    /** Changes a quote that is out and not yet accepted: the customer who reads it again sees a new revision (P2-04). */
    update: (quoteId: number | string, body: QuoteBody) => route<ArtisanInterventionQuote>('patch', `/quotes/${quoteId}`, { body }),
    /** Sends a quote again to the customer who asked for a change, once the artisan has changed it: until then the customer cannot accept it. */
    send: (quoteId: number | string) => route<ArtisanInterventionQuote>('post', `/quotes/${quoteId}/send`),
  },
  cash: {
    /** What is left to take on a mission, and whether the artisan may take it now. */
    position: (interventionId: number | string) => route<CashPosition>('get', `/cash-ledger/interventions/${interventionId}/position`),
    /** Says how much cash the customer gave. The same `requestKey` sent twice writes one collection. */
    collect: (interventionId: number | string, body: CollectCashBody) => route<CollectCashAnswer>('post', `/cash-ledger/interventions/${interventionId}/collect-cash`, { body }),
    /** The artisan's own balance and lines, the newest first, a page at a time. */
    mine: (query: LedgerQuery = {}) => route<LedgerPage>('get', '/cash-ledger/mine', { params: { ...query } }),
  },
  guest: {
    /** The challenge the request form solves in the background (P1-16). `{ enabled: false }` when the server has the check off. */
    challenge: () => route<BotChallenge>('get', '/guest/challenge'),
    /** Makes a request without an account. The answer carries the tracking link, once. */
    create: (body: GuestRequestBody) => route<GuestCreated>('post', '/guest/interventions', { body }),
    /** The tracking page of a visitor: the job, with the link's token. */
    track: (id: number | string, token: string) => route<TrackingIntervention>('get', `/guest/tracking/${id}`, { params: { token } }),
    /** Adds pictures to an open request: `body` is a FormData with up to 5 files in the field `photos`. */
    photos: (id: number | string, token: string, body: unknown) =>
      route<GuestPhotosAnswer>('post', `/guest/interventions/${id}/photos`, { params: { token }, body }),
    /** The quotes that were sent (never a draft), with their lines. */
    quotes: (id: number | string, token: string) => route<TrackingInterventionQuote[]>('get', `/guest/interventions/${id}/quotes`, { params: { token } }),
    /** Accepts a quote. `revision` is the one that was read: a quote edited since is a 409. A quote that lapsed or is being changed is a 400. */
    acceptQuote: (id: number | string, quoteId: number | string, token: string, body: GuestQuoteBody) =>
      route<TrackingInterventionQuote>('post', `/guest/interventions/${id}/quotes/${quoteId}/accept`, { params: { token }, body }),
    /** Refuses a quote. */
    rejectQuote: (id: number | string, quoteId: number | string, token: string, body: GuestQuoteBody) =>
      route<TrackingInterventionQuote>('post', `/guest/interventions/${id}/quotes/${quoteId}/reject`, { params: { token }, body }),
    /** Sends a quote back for a change: the technician edits it and sends it again, and it cannot be accepted until then. */
    requestChange: (id: number | string, quoteId: number | string, token: string, body: GuestQuoteBody) =>
      route<TrackingInterventionQuote>('post', `/guest/interventions/${id}/quotes/${quoteId}/request-modification`, { params: { token }, body }),
    /** Asks a question about a quote: the quote stays as it is and can still be accepted. */
    askQuestion: (id: number | string, quoteId: number | string, token: string, body: GuestQuoteBody) =>
      route<TrackingInterventionQuote>('post', `/guest/interventions/${id}/quotes/${quoteId}/question`, { params: { token }, body }),
    /** How to pay: the ways the company offers, what is left to pay, the account of a transfer, the payment that waits (P2-06). */
    paymentOptions: (id: number | string, token: string) => route<PaymentOptions>('get', `/guest/interventions/${id}/payment-options`, { params: { token } }),
    /**
     * Asks to pay in one way. The same request again returns the payment that waits (`replayed`); another way while one waits is a
     * 409. A transfer's reference is sent with the same request once the transfer is made.
     */
    pay: (id: number | string, token: string, body: GuestPaymentBody) =>
      route<GuestPaymentAnswer>('post', `/guest/interventions/${id}/payments`, { params: { token }, body }),
    /** The customer's opinion on a finished job. It is kept as a review that waits for the team; a second one is a 409. */
    feedback: (id: number | string, token: string, body: GuestFeedbackBody) =>
      route<TrackingIntervention>('post', `/guest/interventions/${id}/feedback`, { params: { token }, body }),
    /** A problem: it opens a complaint the support team reads. */
    problem: (id: number | string, token: string, body: GuestProblemBody) =>
      route<GuestProblemAnswer>('post', `/guest/interventions/${id}/problems`, { params: { token }, body }),
  },
  artisans: {
    /** The signed-in artisan: who they are, whether they are online, how many jobs they closed (P1-15). */
    profile: () => route<ArtisanSelf>('get', '/artisans/me/profile'),
    /** Goes online and starts accepting jobs. */
    goOnline: () => route<ArtisanAvailabilityAnswer>('patch', '/artisans/me/online'),
    /** Goes offline and stops accepting jobs. */
    goOffline: () => route<ArtisanAvailabilityAnswer>('patch', '/artisans/me/offline'),
    /** Tells the server where the artisan is. It does not change whether they are online. */
    location: (body: { latitude: number; longitude: number }) => route<unknown>('patch', '/artisans/me/location', { body }),
    /**
     * One job as its artisan reads it: the customer, the catalog service, the quotes with their lines, the payments, the invoice
     * and, once the job is theirs, its timeline and messages. (`GET /interventions/:id` has none of the quotes, the service or
     * the payments: a screen that needs them reads this route.) A job nobody holds comes back as the board's copy.
     */
    mission: (id: number | string) => route<ArtisanIntervention | BoardIntervention>('get', `/artisans/me/missions/${id}`),
    /** Accepts a job that was given to the artisan. */
    accept: (id: number | string) => route<ArtisanIntervention>('post', `/artisans/me/missions/${id}/accept`),
    /** Refuses a job, or hands it back after accepting it: it returns to the dispatcher's queue. */
    decline: (id: number | string, body: { reason: MissionRejectionReason; note?: string }) =>
      route<MissionRefusalAnswer>('post', `/artisans/me/missions/${id}/reject`, { body }),
    onTheWay: (id: number | string) => route<ArtisanIntervention>('patch', `/artisans/me/missions/${id}/on-the-way`),
    arrived: (id: number | string) => route<ArtisanIntervention>('patch', `/artisans/me/missions/${id}/arrived`),
    start: (id: number | string) => route<ArtisanIntervention>('patch', `/artisans/me/missions/${id}/start`),
  },
  notifications: {
    /** Registers this phone for push notifications (the token moves to the signed-in person if it was another's). */
    registerPushToken: (body: PushTokenBody) => route<unknown>('post', '/notifications/push-tokens', { body }),
    /** Stops pushes to this phone for the signed-in person (on sign-out). The token is encoded: it holds brackets. */
    removePushToken: (token: string) => route<{ success: boolean }>('delete', `/notifications/push-tokens/${encodeURIComponent(token)}`),
  },
  client: {
    /** The jobs of the signed-in customer, in the customer's copy. */
    interventions: () => route<ClientIntervention[]>('get', '/client/interventions'),
    intervention: (id: number | string) => route<ClientIntervention>('get', `/client/interventions/${id}`),
  },
  admin: {
    /** The dispatcher's list: `Paginated`, paged by page and limit. `Row` is the screen's own row type. */
    interventions: <Row>(query: InterventionListQuery = {}) => route<Paginated<Row>>('get', '/admin/interventions', { params: { ...query } }),
    /**
     * The case file of a job (P1-14): the job with its customer and technician, the whole timeline (the lines the
     * people of the job do not read are marked `internal`), every chat, and the notes of the team. `File` is the
     * screen's own type. For the roles that work on jobs; a number that is no job's is a 404.
     */
    intervention: <File>(id: number | string) => route<File>('get', `/admin/interventions/${id}`),
    /**
     * Writes a note on a job that only the back office reads (at most 2000 characters, never blank). The answer is
     * the note as the case file lists it, with its author. `Note` is the screen's own type.
     */
    addNote: <Note>(id: number | string, body: { content: string }) => route<Note>('post', `/admin/interventions/${id}/internal-notes`, { body }),
    /**
     * Moves a job to another status (the server refuses a move the status table does not allow, "assigned", which
     * is the assignment's, and "cancelled", which is the cancellation's). `expectedStatus` is the status the
     * screen showed: if the job has moved since, nothing is written and the answer is a 409. `Row` is the job as
     * the screen reads it.
     */
    changeStatus: <Row>(id: number | string, body: { status: string; note?: string; expectedStatus?: string }) =>
      route<Row>('patch', `/admin/interventions/${id}/status`, { body }),
    /** Cancels a job, with the reason (the customer's and the artisan's timeline say it was cancelled), and its booked visit with it. */
    cancel: <Row>(id: number | string, body: { reason: string; expectedStatus?: string }) =>
      route<Row>('patch', `/admin/interventions/${id}/cancel`, { body }),
  },
  matching: {
    /** Who could take this job, best first, with a score and an arrival time. `Result` is the screen's own type. */
    forIntervention: <Result>(id: number | string, query: MatchQuery = {}) =>
      route<Result>('get', `/matching/admin/interventions/${id}/artisans`, { params: { ...query } }),
    /**
     * Gives the job to this artisan, through the one assignment path (approval, availability, status, notifications).
     * `expectedArtisanId` is who the screen showed as holding the job (null: nobody): if somebody else holds it by
     * now, nothing is written and the answer is a 409.
     */
    assign: <Row>(interventionId: number | string, artisanId: number | string, body: { adminNote?: string; expectedArtisanId?: number | null } = {}) =>
      route<Row>('post', `/matching/admin/interventions/${interventionId}/assign/${artisanId}`, { body }),
  },
  users: {
    /** A page of artisans: `Paginated`, paged by page and limit. `Row` is the screen's own row type. */
    artisans: <Row>(query: ArtisanListQuery = {}) => route<Paginated<Row>>('get', '/users/artisans', { params: { ...query } }),
  },
  proofs: {
    /** A page of proofs: `Paginated`, paged by take and skip. `Row` is the admin's proof record. */
    list: <Row>(query: ProofListQuery = {}) => route<OffsetPaginated<Row>>('get', '/proofs', { params: { ...query } }),
  },
} as const;
