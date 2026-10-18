import type { OffsetPaginated, Paginated } from './generated/envelope';
import type { ArtisanIntervention, BoardIntervention, ClientIntervention, TrackingIntervention } from './generated/views';

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

export const routes = {
  interventions: {
    /** The jobs of the signed-in artisan, in the artisan's copy. */
    assigned: () => route<ArtisanIntervention[]>('get', '/interventions/assigned'),
    /** One job, for an artisan: their own copy when it is theirs, the board's copy while nobody has it. */
    oneAsArtisan: (id: number | string) => route<ArtisanIntervention | BoardIntervention>('get', `/interventions/${id}`),
    /** The tracking page of a visitor: the job, with the link's token. */
    track: (id: number | string, token: string) => route<TrackingIntervention>('get', `/interventions/track/${id}`, { params: { token } }),
  },
  client: {
    /** The jobs of the signed-in customer, in the customer's copy. */
    interventions: () => route<ClientIntervention[]>('get', '/client/interventions'),
    intervention: (id: number | string) => route<ClientIntervention>('get', `/client/interventions/${id}`),
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
