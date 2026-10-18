/**
 * What a push notification says, read on the phone (P1-15).
 *
 * The server sends `type`, `notificationId` and, for a notification about a job, `interventionId`
 * (smart-depannage-serveur: notifications/delivery/push-payload.ts). A tap on the push opens that job.
 * What arrives with a push is not trusted: it is read here, once, and anything that is not what the server
 * sends gives null, so no screen opens from a malformed or foreign payload.
 */
export interface PushTarget {
  type: string;
  notificationId: number | null;
  /** The job the push is about, if it is about one. */
  interventionId: number | null;
}

/** The largest number the server stores for the number of a record (a 32-bit integer). */
const LARGEST_RECORD_ID = 2147483647;

/**
 * The number of a job (or of any record) as a screen or a push hands it over: a whole number from 1 to what the
 * server stores, written as a number or as plain digits. Anything else (a path, a fraction, a sign, a number too
 * large to be one of ours) gives null, so no request is made for it.
 */
export function recordIdOf(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 && value <= LARGEST_RECORD_ID ? value : null;
  }

  // Some push services hand every value back as text, and a link hands over a piece of an address.
  if (typeof value === 'string' && /^[1-9][0-9]{0,9}$/.test(value)) {
    const number = Number(value);

    return number <= LARGEST_RECORD_ID ? number : null;
  }

  return null;
}

export function pushTargetOf(data: unknown): PushTarget | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  const { type, notificationId, interventionId } = data as Record<string, unknown>;

  if (typeof type !== 'string' || !/^[A-Z][A-Z0-9_]{0,63}$/.test(type)) return null;

  return { type, notificationId: recordIdOf(notificationId), interventionId: recordIdOf(interventionId) };
}

/** The kind of token the Expo push service accepts (the same test as the server's). */
export function isExpoPushToken(token: unknown): token is string {
  return typeof token === 'string' && token.length <= 512 && /^(Exponent|Expo)PushToken\[[^\]]+\]$/.test(token);
}
