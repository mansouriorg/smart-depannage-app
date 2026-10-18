import type { ApiErrorBody } from './generated/envelope';

/** The shape of a failed axios call, as far as this package reads it. */
interface FailedCall {
  response?: { status?: number; data?: unknown };
}

/** The body the server gave for a refused request, or null when there was none (no network, a timeout). */
export function apiErrorBody(error: unknown): ApiErrorBody | null {
  const data = (error as FailedCall | null | undefined)?.response?.data;

  return data !== null && typeof data === 'object' ? (data as ApiErrorBody) : null;
}

/** The HTTP status of a refused request, or null when the server did not answer. */
export function apiErrorStatus(error: unknown): number | null {
  const status = (error as FailedCall | null | undefined)?.response?.status;

  return typeof status === 'number' ? status : null;
}

/**
 * The sentence the server gave for a refused request ("Cet artisan n'est pas encore approuvé."), to
 * show to the person, or `fallback` when the server said nothing readable (the network is down, or
 * the server failed: "Internal server error" is nothing a person can act on).
 *
 * The API answers { message: string | string[], issues?: string[] }: `issues` lists why an artisan
 * is not free ("Artisan déjà réservé sur ce créneau."), one per line.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const status = apiErrorStatus(error);

  if (status !== null && status >= 500) return fallback;

  const body = apiErrorBody(error);
  const message = Array.isArray(body?.message)
    ? body.message.filter((item): item is string => typeof item === 'string').join(' ')
    : typeof body?.message === 'string'
      ? body.message
      : '';
  const issues = Array.isArray(body?.issues) ? body.issues.filter((item): item is string => typeof item === 'string') : [];
  const text = [message.trim(), ...issues].filter(Boolean).join('\n');

  return text || fallback;
}
