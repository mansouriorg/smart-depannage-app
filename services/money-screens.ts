import { apiErrorMessage, apiErrorStatus, quoteThatArrived, type ArtisanInterventionQuote } from '../lib/shared';

/**
 * What the quote and cash screens do when a call does not go as planned (P2-05).
 *
 * A call can fail in two ways that mean very different things. The server can answer "no" (a 4xx: the words it gives are
 * for the person), or the answer can be missing (no network, a time-out) or be an error of the server itself (a 5xx). In the
 * second case the server may have done the work all the same, and for a quote that matters: making one has no key to send
 * again safely, so a tap on "send" after a lost answer would make a second quote.
 */

/** The server did not answer, or failed: the work may or may not have been done. */
export function outcomeIsUnknown(error: unknown): boolean {
  const status = apiErrorStatus(error);

  return status === null || status === 408 || status >= 500;
}

export type QuoteSendResult =
  /** The server answered with the quote. */
  | { kind: 'sent'; quote: ArtisanInterventionQuote }
  /** The answer was lost, but the mission shows the quote: it went through. */
  | { kind: 'recovered'; quote: ArtisanInterventionQuote }
  /** The server said no, in words for the person. */
  | { kind: 'refused'; message: string }
  /** No answer, and the mission was read again and shows no new quote: it can be sent again. */
  | { kind: 'not-sent'; message: string }
  /** No answer, and the mission could not be read either: the person has to look before sending again. */
  | { kind: 'unknown'; message: string }
  /** The changes were saved, but the quote did not go back to the customer (who cannot accept it until it does): tapping again sends it. */
  | { kind: 'changed-not-resent'; message: string };

/** A text that ends like a sentence, so that it can be followed by another. */
function sentence(text: string): string {
  const trimmed = text.trim();

  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export const QUOTE_WORDS = {
  refused: 'Le devis n’a pas pu être envoyé. Réessayez.',
  refusedChange: 'Les modifications n’ont pas pu être enregistrées. Réessayez.',
  notSent: 'Le devis n’a pas été envoyé : le serveur n’a pas répondu. Vous pouvez réessayer.',
  notSentChange: 'Le serveur n’a pas répondu : les modifications ne sont peut-être pas enregistrées. Vous pouvez réessayer.',
  unknown: 'Le serveur n’a pas répondu : le devis est peut-être parti. Ouvrez la mission pour le vérifier avant de le renvoyer.',
  changedUnknown: 'Les modifications sont enregistrées. Le serveur n’a pas répondu ensuite : le devis est peut-être reparti vers le client. Ouvrez la mission pour le vérifier.',
  changedNotResentOffline: 'Les modifications sont enregistrées, mais le devis n’est pas reparti vers le client : le serveur n’a pas répondu. Touchez « Renvoyer au client » pour réessayer.',
  changedNotResent: (why: string) => `Les modifications sont enregistrées, mais le devis n’a pas pu repartir vers le client : ${sentence(why)} Touchez « Renvoyer au client » pour réessayer.`,
} as const;

/**
 * Sends a quote (`mode: 'create'`) or its changes (`'update'`) and says what happened. `send` makes the call. After a call whose
 * outcome is unknown, `reload` reads the quotes of the mission again, and a new quote with the title and the total that were
 * sent is the one that went through. Changing a quote is safe to send again (the same content writes nothing new), so it is
 * not looked for.
 *
 * A quote the customer sent back for a change is changed and then sent again (`resend`): the customer cannot accept it before.
 * The two calls can fail apart. When the changes are saved and the sending fails, the quote is still out of the customer's
 * hands and the artisan is told so; when the answer of the sending is lost, the quote is read again and, if it is out, the sending
 * went through. (A second sending of a quote that is already out is refused by the server, which is why the quote is read first.)
 */
export async function sendQuote(options: {
  mode: 'create' | 'update';
  send: () => Promise<ArtisanInterventionQuote>;
  /** Sends the quote that was just changed to the customer again (`POST /quotes/:id/send`); called when the answer of the change says the customer sent it back. */
  resend?: (quote: ArtisanInterventionQuote) => Promise<ArtisanInterventionQuote>;
  quotesBefore: ReadonlyArray<{ id: number }>;
  sent: { title: string; amountTTC: number };
  reload: () => Promise<ReadonlyArray<ArtisanInterventionQuote> | null | undefined>;
}): Promise<QuoteSendResult> {
  const change = options.mode === 'update';

  let saved: ArtisanInterventionQuote;

  try {
    saved = await options.send();
  } catch (error) {
    if (!outcomeIsUnknown(error)) return { kind: 'refused', message: apiErrorMessage(error, change ? QUOTE_WORDS.refusedChange : QUOTE_WORDS.refused) };

    if (change) return { kind: 'not-sent', message: QUOTE_WORDS.notSentChange };

    let after: ReadonlyArray<ArtisanInterventionQuote> | null | undefined;

    try {
      after = await options.reload();
    } catch {
      return { kind: 'unknown', message: QUOTE_WORDS.unknown };
    }

    if (after === null || after === undefined) return { kind: 'unknown', message: QUOTE_WORDS.unknown };

    const arrived = quoteThatArrived(options.quotesBefore, after, options.sent);

    return arrived ? { kind: 'recovered', quote: arrived } : { kind: 'not-sent', message: QUOTE_WORDS.notSent };
  }

  // The answer of the change decides, not what the screen knew when it opened: the customer may have asked for a change since.
  if (!change || !options.resend || saved.status !== 'MODIFICATION_REQUESTED') return { kind: 'sent', quote: saved };

  try {
    return { kind: 'sent', quote: await options.resend(saved) };
  } catch (error) {
    const unknown = outcomeIsUnknown(error);
    let after: ReadonlyArray<ArtisanInterventionQuote> | null | undefined;

    // Whatever the server said, the quote is read again: if it is out, the customer has it.
    try {
      after = await options.reload();
    } catch {
      after = null;
    }

    const now = (after ?? []).find((quote) => quote.id === saved.id);

    if (now && now.status === 'SENT') return { kind: 'recovered', quote: now };

    if (after === null || after === undefined) {
      return unknown ? { kind: 'unknown', message: QUOTE_WORDS.changedUnknown } : { kind: 'changed-not-resent', message: QUOTE_WORDS.changedNotResent(apiErrorMessage(error, 'le serveur a refusé.')) };
    }

    return { kind: 'changed-not-resent', message: unknown ? QUOTE_WORDS.changedNotResentOffline : QUOTE_WORDS.changedNotResent(apiErrorMessage(error, 'le serveur a refusé.')) };
  }
}

export const CASH_WORDS = {
  refused: 'L’encaissement n’a pas pu être enregistré. Réessayez.',
  unknown: 'Le serveur n’a pas répondu. L’encaissement est peut-être enregistré : regardez le reste à payer avant de réessayer. Le même montant ne sera pas enregistré deux fois.',
} as const;

export interface CollectFailure {
  message: string;
  /** The server said no: what is left to take may have changed, so the screen reads it again. */
  refused: boolean;
}

/** What the artisan is told when the collection did not go through. */
export function collectFailure(error: unknown): CollectFailure {
  if (outcomeIsUnknown(error)) return { message: CASH_WORDS.unknown, refused: false };

  return { message: apiErrorMessage(error, CASH_WORDS.refused), refused: true };
}
