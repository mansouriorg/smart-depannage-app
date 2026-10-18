import { callApi, type RouteSpec, type Send } from '../lib/shared';
import api from './api';

/**
 * Makes a call that the shared package describes (`routes.artisans.accept(12)`) and gives back the type of its
 * answer. It goes through the app's HTTP client, so the token, the silent refresh and the time-out are the same
 * as everywhere else.
 */
export function call<Response>(route: RouteSpec<Response>, options: { signal?: AbortSignal } = {}): Promise<Response> {
  // `signal` lets a caller that has run out of patience (the sign-out) cancel the request instead of leaving it
  // to finish, and to fail, after the session it needed is gone.
  const send: Send = (config) => api.request({ ...config, signal: options.signal });

  return callApi(send, route);
}
