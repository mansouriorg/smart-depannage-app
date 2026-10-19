import { apiErrorBody, apiErrorStatus } from './errors';

/**
 * The bot check of the request form, as the page answers it (P1-16).
 *
 * The server (GET /guest/challenge) hands out a signed challenge. The page finds a number such that the SHA-256
 * of "<challenge>:<number>" starts with `bits` zero bits, and sends the challenge, that number and an empty
 * hidden field with the form. See src/common/bot-check/bot-check.ts in the server for what it refuses and why.
 *
 * Finding the number is the same work on every device; the hash is the one thing that differs (Web Crypto in
 * a browser, the platform's in an app), so it is handed in.
 */

/** What GET /guest/challenge answers: nothing to do when the server has the check off. */
export type BotChallenge =
  | { enabled: false }
  | {
      enabled: true;
      challenge: string;
      /** Zero bits the hash must start with. */
      bits: number;
      /** Milliseconds the page must wait after receiving the challenge before sending the form. */
      waitMs: number;
      /** Milliseconds the challenge stays good. */
      expiresInMs: number;
    };

/** The three fields a request form adds. `website` is the hidden field: a person leaves it empty, so it is sent as it is. */
export interface BotCheckBody {
  botChallenge?: string;
  botSolution?: string;
  website: string;
}

/** The `code` of the 400 the server answers when the check fails, whatever the reason (the same answer for all of them). */
export const BOT_CHECK_FAILED_CODE = 'BOT_CHECK_FAILED';

/** True when a refused request was refused by the bot check: the page then asks for a new challenge and tries again. */
export function isBotCheckRefusal(error: unknown): boolean {
  return apiErrorStatus(error) === 400 && (apiErrorBody(error) as { code?: unknown } | null)?.code === BOT_CHECK_FAILED_CODE;
}

export type Sha256 = (text: string) => Promise<Uint8Array>;

/** How many zero bits a digest starts with. */
export function leadingZeroBits(digest: Uint8Array): number {
  let bits = 0;

  for (const byte of digest) {
    if (byte === 0) {
      bits += 8;
      continue;
    }

    bits += Math.clz32(byte) - 24;
    break;
  }

  return bits;
}

export class BotCheckCancelled extends Error {
  constructor() {
    super('The bot check was cancelled.');
    this.name = 'BotCheckCancelled';
  }
}

export interface SolveOptions {
  /** Stops the search (the person left the page, or the challenge is replaced). */
  signal?: { aborted: boolean };
  /** Hashes started together: the digests of a browser are asynchronous, so a batch goes faster than one by one. */
  batch?: number;
  /** Give up after this many hashes (a challenge of `bits` needs 2^bits on average; the default is 64 times that). */
  maxTries?: number;
}

/**
 * The number that solves a challenge: the first, in the order 0, 1, 2 ... 9, a, b ... (base 36), whose hash starts
 * with `bits` zero bits. Rejects with BotCheckCancelled when `signal` is aborted, and with an Error after `maxTries`.
 */
export async function solveChallenge(challenge: string, bits: number, sha256: Sha256, options: SolveOptions = {}): Promise<string> {
  const batch = Math.max(1, Math.floor(options.batch ?? 256));
  const maxTries = options.maxTries ?? 2 ** Math.min(bits + 6, 30);

  for (let start = 0; start < maxTries; start += batch) {
    if (options.signal?.aborted) throw new BotCheckCancelled();

    const candidates = Array.from({ length: batch }, (_, offset) => (start + offset).toString(36));
    const digests = await Promise.all(candidates.map((candidate) => sha256(`${challenge}:${candidate}`)));
    const found = digests.findIndex((digest) => leadingZeroBits(digest) >= bits);

    if (found >= 0) return candidates[found];
  }

  throw new Error('No solution was found for the challenge.');
}

/**
 * The fields to add to the form: the solved challenge (or nothing when the server asks for none), and the hidden field as
 * the page has it. A person never sees that field, so it is empty; a script that fills every field fills this one too, and
 * the server refuses it.
 */
export function botCheckBody(solved: { challenge: string; solution: string } | null, hiddenField = ''): BotCheckBody {
  return solved ? { botChallenge: solved.challenge, botSolution: solved.solution, website: hiddenField } : { website: hiddenField };
}

/** How long the page still has to wait before the server will accept the form (never negative). */
export function waitLeft(waitMs: number, receivedAt: number, now: number): number {
  return Math.max(0, waitMs - Math.max(0, now - receivedAt));
}

/** True when a challenge received at `receivedAt` would be refused as too old at `now` (with a minute of margin). */
export function challengeExpired(expiresInMs: number, receivedAt: number, now: number): boolean {
  return now - receivedAt >= expiresInMs - 60_000;
}
