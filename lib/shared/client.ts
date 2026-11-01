import type { OffsetPaginated, Paginated } from './generated/envelope';
import type { Locale } from './generated/i18n';
import type { DispatchSort, DispatchViewId } from './generated/intervention-status';
import type { ArtisanAvailabilityAnswer, ArtisanSelf, MissionRefusalAnswer } from './artisan';
import type { MissionRejectionReason } from './generated/enums';
import type { ArtisanIntervention, ArtisanInterventionQuote, BoardIntervention, ClientIntervention, TrackingIntervention, TrackingInterventionQuote } from './generated/views';
import type { CashPosition, CollectCashAnswer, CollectCashBody, LedgerPage, LedgerQuery } from './cash';
import { financeParams } from './finance';
import type {
  ArtisanBalance,
  ArtisanLedger,
  FinanceInvoicesQuery,
  FinancePage,
  FinancePaymentsExportQuery,
  FinancePaymentsQuery,
  FinancePeriodQuery,
  FinanceSummary,
  InvoiceRow,
  PayoutPeriodQuery,
  PayoutPreview,
  PayoutRow,
  PaymentRow,
  RefundsDue,
  RemittanceBody,
} from './finance';
import { complaintParams } from './complaints';
import type { ComplaintCase, ComplaintPage, ComplaintQuery } from './complaints';
import { reviewParams } from './reviews';
import type { ReviewPage, ReviewQuery, ReviewRow, ReviewStatus } from './reviews';
import type { CompanyBody, CompanySettings } from './company';
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
  /** Headers this call adds (an `Idempotency-Key`, P2-10). Left out when there are none. */
  readonly headers?: Readonly<Record<string, string>>;
  /** Never set: it only carries the type of the answer. */
  readonly response?: Response;
}

export interface RequestConfig {
  method: string;
  url: string;
  params?: unknown;
  data?: unknown;
  /** Only present when the route adds headers. */
  headers?: Record<string, string>;
}

/** What `callApi` needs from the HTTP library: send this, give back an object with `data`. With axios: `(config) => api.request(config)`. */
export type Send = (config: RequestConfig) => Promise<{ data: unknown }>;

export async function callApi<Response>(send: Send, route: RouteSpec<Response>): Promise<Response> {
  const answer = await send({ method: route.method, url: route.url, params: route.params, data: route.body, ...(route.headers ? { headers: { ...route.headers } } : {}) });

  return answer.data as Response;
}

function route<Response>(method: HttpMethod, url: string, extra: Pick<RouteSpec<Response>, 'params' | 'body' | 'headers'> = {}): RouteSpec<Response> {
  return { method, url, ...extra };
}

/** The header that makes a repeated request the same request (a double tap, a retry after a lost answer): see src/modules/payments/idempotency.ts on the server. */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/** What the server accepts as a key: letters, digits and `_ . : -`, up to 100 characters. */
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_.:-]{1,100}$/;

/**
 * A new key for one attempt of a request. The same key is sent again when the attempt is repeated (the answer was lost, the button was
 * tapped twice), and a new one for a new decision. Not a secret: it only tells the server "this is the same request".
 */
export function newIdempotencyKey(): string {
  const random = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;

  if (random?.randomUUID) return random.randomUUID();

  return `k${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * How long a key is kept for a repeat of the same request. A retry after a lost answer comes within seconds; a tap a few minutes later
 * is a new decision, and the server answers a repeated key with the payment it made, even one that has ended since (a page to pay on
 * that is no longer good). Two minutes is longer than any retry and shorter than the time a payment takes to lapse.
 */
export const KEY_KEPT_MS = 2 * 60_000;

/** The key of an attempt, with what it was made for. */
export interface KeyedAttempt {
  method: string;
  /** What the request carried besides the way of paying (the reference of a transfer; empty when there is none). */
  reference: string;
  key: string;
  at: number;
}

/**
 * The key to send with a request. The earlier attempt's key is sent again only for the same request (the same way of paying and the
 * same reference) and only for a short while after it began; anything else is a new decision and gets a key of its own, so that a
 * request that carries something new (the reference of a transfer made since) is never taken for the one that was already made.
 */
export function attemptKey(previous: KeyedAttempt | null, method: string, reference: string, now: number, makeKey: () => string = newIdempotencyKey): KeyedAttempt {
  if (previous && previous.method === method && previous.reference === reference && now >= previous.at && now - previous.at < KEY_KEPT_MS) return previous;

  return { method, reference, key: makeKey(), at: now };
}

/** The headers of a request that carries a key; none when there is no key (or it is not one the server accepts: it would be refused with a 400). */
function keyHeaders(key: string | undefined): Pick<RouteSpec<unknown>, 'headers'> {
  return key && IDEMPOTENCY_KEY_PATTERN.test(key) ? { headers: { [IDEMPOTENCY_HEADER]: key } } : {};
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
    pay: (id: number | string, token: string, body: GuestPaymentBody, idempotencyKey?: string) =>
      route<GuestPaymentAnswer>('post', `/guest/interventions/${id}/payments`, { params: { token }, body, ...keyHeaders(idempotencyKey) }),
    /**
     * Asks the server to ask the card provider where the payment of this job stands (the page does it when the customer comes back from
     * the provider's page, and again while it waits), and gives the options as they are then (P2-10). Nothing the caller sends decides
     * the answer: the provider's does.
     */
    checkPayment: (id: number | string, token: string) =>
      route<PaymentOptions>('post', `/guest/interventions/${id}/payments/check`, { params: { token } }),
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
  finance: {
    /** The totals of a period (the last seven days when none is named), and what waits whatever the period (P2-08). */
    summary: (query: FinancePeriodQuery = {}) => route<FinanceSummary>('get', '/finance/summary', { params: financeParams(query) }),
    /** Payments: the ones waiting for the team, the money received, the money given back. */
    payments: (query: FinancePaymentsQuery = {}) => route<FinancePage<PaymentRow>>('get', '/finance/payments', { params: financeParams(query) }),
    /** The CSV of the same filters (a file: the screen downloads it with the token, `callApi` does not read files). */
    exportPayments: (query: FinancePaymentsExportQuery = {}) => route<string>('get', '/finance/payments/export', { params: financeParams(query) }),
    /** Invoices with their credit notes and what is left to pay. */
    invoices: (query: FinanceInvoicesQuery = {}) => route<FinancePage<InvoiceRow>>('get', '/finance/invoices', { params: financeParams(query) }),
    /** The jobs where a credit note leaves money to give back. */
    refundsDue: () => route<RefundsDue>('get', '/finance/refunds-due'),
    /** Every artisan who holds cash or owes commission, those who owe the most first. */
    balances: () => route<ArtisanBalance[]>('get', '/cash-ledger/balances'),
    /** One artisan's ledger: the figures and a page of lines. */
    artisanLedger: (artisanId: number | string, query: { limit?: number; before?: number } = {}) =>
      route<ArtisanLedger>('get', `/cash-ledger/artisans/${artisanId}`, { params: financeParams(query) }),
    /** The artisan hands commission over to the platform. */
    remit: <Answer>(artisanId: number | string, body: RemittanceBody) => route<Answer>('post', `/cash-ledger/artisans/${artisanId}/remittances`, { body }),
    /** Confirms that the money arrived (a transfer, or the cash an artisan took). */
    confirmPayment: <Answer>(id: number | string, body: { reference?: string; adminNote?: string } = {}) => route<Answer>('patch', `/payments/${id}/confirm`, { body }),
    failPayment: <Answer>(id: number | string, body: { reason?: string; adminNote?: string } = {}) => route<Answer>('patch', `/payments/${id}/fail`, { body }),
    cancelPayment: <Answer>(id: number | string, body: { reason?: string; adminNote?: string } = {}) => route<Answer>('patch', `/payments/${id}/cancel`, { body }),
    /** Gives money back: no amount refunds what is left of the payment. */
    refundPayment: <Answer>(id: number | string, body: { amount?: number; reason?: string; adminNote?: string } = {}, idempotencyKey?: string) =>
      route<Answer>('patch', `/payments/${id}/refund`, { body, ...keyHeaders(idempotencyKey) }),
    /** Asks the card provider where a payment stands and settles it from the answer (a payment that waits, or that went to the team to check). */
    checkPayment: <Answer>(id: number | string) => route<Answer>('post', `/payments/${id}/check`),
    /** A credit note on an invoice: the reason the customer reads, and the amount with VAT (all that is left when none is sent). */
    creditNote: <Answer>(invoiceId: number | string, body: { reason: string; amountTTC?: number }) => route<Answer>('post', `/invoices/${invoiceId}/credit-notes`, { body }),
    /** The PDF of an invoice, and of a credit note (files: the screen downloads them with the token, `callApi` does not read files). */
    invoicePdf: (invoiceId: number | string) => route<string>('get', `/invoices/${invoiceId}/pdf`),
    creditNotePdf: (creditNoteId: number | string) => route<string>('get', `/invoices/credit-notes/${creditNoteId}/pdf`),
    payouts: () => route<PayoutRow[]>('get', '/business/payouts'),
    payoutPreview: (query: PayoutPeriodQuery) => route<PayoutPreview>('get', '/business/payouts/preview', { params: { ...query } }),
    createPayout: (body: PayoutPeriodQuery & { notes?: string }) => route<PayoutRow>('post', '/business/payouts', { body }),
    markPayoutPaid: (id: number | string, body: { paymentReference?: string; paidAt?: string } = {}) => route<PayoutRow>('patch', `/business/payouts/${id}/paid`, { body }),
    cancelPayout: (id: number | string) => route<PayoutRow>('patch', `/business/payouts/${id}/cancel`),
  },
  complaints: {
    /** A page of complaints with the size of each view (P2-09): `view`, `status`, `mine`, `search`, `sort`, paged by page and limit. */
    list: (query: ComplaintQuery = {}) => route<ComplaintPage>('get', '/admin/complaints', { params: complaintParams(query) }),
    /** One complaint: the people, the job, the thread, the journal and the money of the job. */
    one: (id: number | string) => route<ComplaintCase>('get', `/admin/complaints/${id}`),
    /** Gives the complaint to an agent of the team; it passes to "en cours". The agent is told. */
    assign: <Answer>(id: number | string, body: { assignedToId: number }) => route<Answer>('patch', `/complaints/admin/${id}/assign`, { body }),
    /** Moves the status; the person who filed the complaint is told of the new status (not of the note). */
    setStatus: <Answer>(id: number | string, body: { status: string; note?: string }) => route<Answer>('patch', `/complaints/admin/${id}/status`, { body }),
    /** Closes the complaint as resolved, with the explanation the customer reads. */
    resolve: <Answer>(id: number | string, body: { resolutionNotes: string }) => route<Answer>('patch', `/complaints/admin/${id}/resolve`, { body }),
    /** Writes in the thread: to the person who filed the complaint (they are told), or internal (the team alone reads it). */
    reply: <Answer>(id: number | string, body: { content: string; isInternal?: boolean }) => route<Answer>('post', `/complaints/${id}/messages`, { body }),
    /** A line of the journal of the complaint. */
    note: <Answer>(id: number | string, body: { content: string }) => route<Answer>('post', `/admin/complaints/${id}/internal-notes`, { body }),
    /** Accepts (with the amount) or refuses the refund the customer asked for. Accepting does not move money: finance pays it. */
    decideRefund: <Answer>(id: number | string, body: { approved: boolean; amount?: number; note?: string }) => route<Answer>('patch', `/admin/complaints/${id}/refund`, { body }),
  },
  reviews: {
    /** A page of the moderation queue (P2-09), with the size of each tab: paged by skip and take. */
    queue: (query: ReviewQuery = {}) => route<ReviewPage>('get', '/reviews/admin', { params: reviewParams(query) }),
    /** Publishes, refuses or hides a review. Refusing and hiding need a reason. */
    moderate: (id: number | string, body: { status: ReviewStatus; moderationReason?: string }) => route<ReviewRow>('patch', `/reviews/admin/${id}/moderate`, { body }),
  },
  company: {
    /** The identity of the company, as the invoices print it, with its VAT rates and the accountant's confirmation (P2-09). */
    get: () => route<CompanySettings>('get', '/admin/settings/company'),
    /** Saves what changed. Changing what an invoice prints takes the confirmation away unless it is given again. */
    save: (body: CompanyBody) => route<CompanySettings>('patch', '/admin/settings/company', { body }),
  },
  users: {
    /** The agents of the team a complaint can be given to (support and administrators; the screen asks for one role at a time). */
    team: <Row>(role: string) => route<{ data: Row[] }>('get', '/users', { params: { role, limit: 100 } }),
    /** A page of artisans: `Paginated`, paged by page and limit. `Row` is the screen's own row type. */
    artisans: <Row>(query: ArtisanListQuery = {}) => route<Paginated<Row>>('get', '/users/artisans', { params: { ...query } }),
    /** Sets the language of the signed-in account (P3-04): the notifications and messages sent to this person follow it. Any signed-in role. */
    setLocale: (locale: Locale) => route<{ locale: Locale }>('patch', '/users/me/locale', { body: { locale } }),
  },
  proofs: {
    /** A page of proofs: `Paginated`, paged by take and skip. `Row` is the admin's proof record. */
    list: <Row>(query: ProofListQuery = {}) => route<OffsetPaginated<Row>>('get', '/proofs', { params: { ...query } }),
  },
} as const;
