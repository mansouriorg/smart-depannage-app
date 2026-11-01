import type { ApiErrorBody } from './generated/envelope';
import { DEFAULT_LOCALE, type Locale } from './generated/i18n';
import { message } from './i18n';

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

// ----------------------------------------------------------
// The sentences for when the server gave none (P3-04)
// ----------------------------------------------------------

/** The generic failures an app words itself, when the server's sentence is missing or is nothing a person can act on. */
export const ERROR_KINDS = ['generic', 'network', 'timeout', 'server', 'tooManyAttempts', 'botCheck', 'sessionExpired'] as const;

export type ErrorKind = (typeof ERROR_KINDS)[number];

/** The sentence for a kind of failure, in a language (`errors.*` in the catalogue). */
export function errorText(kind: ErrorKind, locale: Locale = DEFAULT_LOCALE): string {
  return message(locale, `errors.${kind}`);
}

/** The codes with which axios says that the request ran out of time. */
const TIMEOUT_CODES: readonly string[] = ['ECONNABORTED', 'ETIMEDOUT'];

/**
 * What kind of failure a failed call is: no answer at all is the network (or a timeout), a server error is the server, 429 is too many
 * tries, 401 is a session that ended; anything else is generic. (`botCheck` is set by the caller that knows the check failed.)
 */
export function errorKindOf(error: unknown): ErrorKind {
  const status = apiErrorStatus(error);

  if (status === null) {
    const code = (error as { code?: unknown } | null | undefined)?.code;

    return typeof code === 'string' && TIMEOUT_CODES.includes(code) ? 'timeout' : 'network';
  }

  if (status >= 500) return 'server';
  if (status === 429) return 'tooManyAttempts';
  if (status === 401) return 'sessionExpired';

  return 'generic';
}

/** The sentence the server gave or, failing that, the generic one for this kind of failure, in the language. */
export function apiErrorText(error: unknown, locale: Locale = DEFAULT_LOCALE): string {
  return apiErrorMessage(error, errorText(errorKindOf(error), locale));
}
