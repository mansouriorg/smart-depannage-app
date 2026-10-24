import { formatDinars, formatMillimes, readAmount, toMillimes } from './money';

/**
 * The cash an artisan takes from a customer and the commission it brings to the platform (P2-05). The server side is
 * P2-02 (smart-depannage-serveur: src/modules/cash-ledger). Written by hand, not generated, like `artisan.ts`: the fields below are
 * the ones the apps read of POST /cash-ledger/interventions/:id/collect-cash, GET /cash-ledger/mine and
 * GET /cash-ledger/interventions/:id/position.
 *
 * Every amount is in dinars, as the server sends it (up to three decimals); the functions here work on whole millimes.
 */

/** The kinds of line of a ledger. */
export type LedgerType = 'COLLECTION' | 'REMITTANCE' | 'REVERSAL' | 'ADJUSTMENT';

/** What the figures of an artisan say. */
export interface LedgerTotals {
  currency: string;
  /** The cash taken from customers, net of what was taken back. */
  cashCollected: number;
  /** The commission that cash brings to the platform. */
  commissionDue: number;
  /** What the artisan has paid to the platform so far. */
  commissionRemitted: number;
  /** What the artisan still owes the platform: negative when they have paid more than they owed. */
  balance: number;
}

export interface LedgerEntry {
  id: number;
  type: LedgerType;
  interventionId: number | null;
  paymentId: number | null;
  cashAmount: number;
  commissionAmount: number;
  commissionRate: number | null;
  currency: string;
  reference: string | null;
  note: string | null;
  reversesId: number | null;
  /** An ISO date. */
  createdAt: string;
}

/** GET /cash-ledger/mine: the figures and one page of lines, the newest first. */
export interface LedgerPage {
  totals: LedgerTotals;
  entries: LedgerEntry[];
  /** Send it as `before` to read the next page; null at the end. */
  nextBefore: number | null;
}

export interface LedgerQuery {
  limit?: number;
  before?: number;
}

/** GET /cash-ledger/interventions/:id/position: what is left to take on a mission, and whether the artisan may take it now. */
export interface CashPosition {
  interventionId: number;
  currency: string;
  document: 'INVOICE' | 'QUOTE' | null;
  total: number | null;
  received: number;
  remaining: number | null;
  collected: number;
  canCollect: boolean;
  /** Why not, in the server's words. */
  reason: string | null;
}

/** What POST /cash-ledger/interventions/:id/collect-cash takes. */
export interface CollectCashBody {
  amount: number;
  note?: string;
  /** Required: the same key sent twice writes one collection. */
  requestKey: string;
}

export interface CollectCashAnswer {
  /** True when this key had been used before: nothing was written again. */
  replayed: boolean;
  payment: { id: number; interventionId: number; method: string; status: string; currency: string; amount: number; createdAt: string };
  entry: LedgerEntry;
  totals: LedgerTotals;
}

// ----------------------------------------------------------
// The key of a tap
// ----------------------------------------------------------

/** A text of about 27 characters that no other tap of this artisan has used (the server asks for 8 to 64): the time, then three random parts. */
export function newRequestKey(random: () => number = Math.random, now: () => number = Date.now): string {
  const part = () => Math.floor(random() * 36 ** 6).toString(36).padStart(6, '0').slice(-6);

  return `k${now().toString(36)}${part()}${part()}${part()}`;
}

/** The keys that the tries to take cash on one job have used: one key for each amount that was sent. */
export interface CollectAttempts {
  job: string;
  /** The amount in millimes, then the key that went with it. */
  keys: Record<number, string>;
}

/**
 * The key for the amount the artisan is sending. The answer to a try can be lost on the way, so the artisan taps again and
 * the first try may have gone through: the same amount on the same job must go with the same key (the server then answers the
 * first try again instead of writing a second collection). That holds when the amount was changed in between and put back:
 * each amount keeps its own key, so no amount that may have been written is written a second time under a new key. A key is
 * never used for two amounts (the server refuses it), and another job starts again with no key.
 */
export function keyFor(previous: CollectAttempts | null, job: number | string, millimes: number, makeKey: () => string = newRequestKey): { attempts: CollectAttempts; key: string } {
  const here = previous !== null && previous.job === String(job) ? previous : { job: String(job), keys: {} as Record<number, string> };
  const known: string | undefined = here.keys[millimes];

  if (known !== undefined) return { attempts: here, key: known };

  const key = makeKey();

  return { attempts: { job: here.job, keys: { ...here.keys, [millimes]: key } }, key };
}

// ----------------------------------------------------------
// What the artisan types
// ----------------------------------------------------------

export type CashAmountRead = { ok: true; millimes: number } | { ok: false; message: string };

const LARGEST_AMOUNT = 99_999_999_999;

/** The amount the artisan typed, checked against what is left to take on the job. */
export function readCashAmount(text: unknown, position: Pick<CashPosition, 'remaining' | 'currency'>): CashAmountRead {
  const read = readAmount(text, LARGEST_AMOUNT);

  if (!read.ok) {
    return {
      ok: false,
      message:
        read.problem === 'empty'
          ? 'Entrez le montant reçu du client.'
          : read.problem === 'decimals'
            ? 'Un montant a au plus trois décimales (millimes).'
            : read.problem === 'too-big'
              ? 'Ce montant est trop grand.'
              : 'Montant invalide : écrivez par exemple 45 ou 45,500.',
    };
  }

  if (read.millimes <= 0) return { ok: false, message: 'Le montant doit être supérieur à 0.' };

  if (position.remaining !== null && read.millimes > toMillimes(position.remaining)) {
    return { ok: false, message: `Le montant dépasse ce qu’il reste à payer (${formatDinars(position.remaining)}).` };
  }

  return { ok: true, millimes: read.millimes };
}

/** The sentence after a collection went through. */
export function collectedWords(answer: Pick<CollectCashAnswer, 'replayed' | 'entry' | 'totals'>): string {
  const head = answer.replayed
    ? `Cet encaissement de ${formatDinars(answer.entry.cashAmount)} était déjà enregistré.`
    : `${formatDinars(answer.entry.cashAmount)} encaissés.`;

  return `${head} ${balanceSentence(answer.totals)}`;
}

// ----------------------------------------------------------
// Reading a ledger
// ----------------------------------------------------------

export type BalanceTone = 'owed' | 'clear' | 'credit';

export interface LedgerSummary {
  tone: BalanceTone;
  /** What the big figure is about. */
  headline: string;
  /** The big figure, without a sign. */
  amountText: string;
  /** What the artisan keeps of the cash: the cash taken, less the commission. */
  keepsText: string;
}

/** The balance the artisan owes the platform, in a sentence. */
export function balanceSentence(totals: Pick<LedgerTotals, 'balance'>): string {
  const balance = toMillimes(totals.balance);

  if (balance > 0) return `Vous devez ${formatMillimes(balance)} à la plateforme.`;
  if (balance < 0) return `La plateforme vous doit ${formatMillimes(-balance)}.`;

  return 'Vous êtes à jour : rien à reverser à la plateforme.';
}

/**
 * What is said under the big figure. The cash the artisan keeps is the cash less the commission, which is only a thing to say when
 * cash was taken and the commission is a share of it. A ledger that holds only a correction of the back office (a balance at the
 * start, a fix) has a commission with no cash behind it: it says so instead of a "you keep" that would be negative or false.
 */
function keepsSentence(cash: number, commissionDue: number): string {
  if (cash === 0 && commissionDue === 0) return 'Aucun encaissement pour le moment.';

  if (cash > 0) {
    if (commissionDue >= 0 && commissionDue <= cash) return `Sur ${formatMillimes(cash)} encaissés, vous gardez ${formatMillimes(cash - commissionDue)}.`;

    return commissionDue > cash
      ? `Sur ${formatMillimes(cash)} encaissés, la commission due est de ${formatMillimes(commissionDue)}, régularisations comprises.`
      : `Sur ${formatMillimes(cash)} encaissés, la commission a été corrigée par l’équipe : voir l’historique.`;
  }

  if (cash === 0) return commissionDue > 0 ? 'Ce solde vient de régularisations enregistrées par l’équipe : voir l’historique.' : 'Votre commission a été corrigée par l’équipe : voir l’historique.';

  return 'Des encaissements ont été annulés ou corrigés par l’équipe : voir l’historique.';
}

/** The top of the earnings screen. */
export function ledgerSummary(totals: LedgerTotals): LedgerSummary {
  const balance = toMillimes(totals.balance);
  const cash = toMillimes(totals.cashCollected);
  const commissionDue = toMillimes(totals.commissionDue);

  return {
    tone: balance > 0 ? 'owed' : balance < 0 ? 'credit' : 'clear',
    headline: balance > 0 ? 'À reverser à la plateforme' : balance < 0 ? 'La plateforme vous doit' : 'Vous êtes à jour',
    amountText: formatMillimes(Math.abs(balance)),
    keepsText: keepsSentence(cash, commissionDue),
  };
}

export interface EntryWords {
  title: string;
  /** What the line does to what the artisan owes, with its sign: "+23,800 DT" owes more, "-10,000 DT" owes less. */
  effect: string;
  /** Whether the line makes the debt bigger, smaller, or neither. */
  direction: 'up' | 'down' | 'none';
  /** The cash of the line, with its sign; null when the line moves no cash. */
  cash: string | null;
  /** The rate, the number of a transfer, the words of whoever wrote the line. */
  detail: string | null;
}

const signed = (millimes: number): string => (millimes > 0 ? `+${formatMillimes(millimes)}` : formatMillimes(millimes));

const missionOf = (entry: Pick<LedgerEntry, 'interventionId'>): string => (entry.interventionId !== null ? ` – mission #${entry.interventionId}` : '');

/** A line of the ledger in words. */
export function entryWords(entry: LedgerEntry): EntryWords {
  const commission = toMillimes(entry.commissionAmount);
  const cash = toMillimes(entry.cashAmount);
  const title =
    entry.type === 'COLLECTION'
      ? `Encaissement${missionOf(entry)}`
      : entry.type === 'REMITTANCE'
        ? 'Versement à la plateforme'
        : entry.type === 'REVERSAL'
          ? `Encaissement annulé${missionOf(entry)}`
          : `Régularisation${missionOf(entry)}`;
  const parts: string[] = [];

  if (entry.type === 'COLLECTION' && entry.commissionRate !== null) parts.push(`Commission de ${String(Number(entry.commissionRate.toFixed(2))).replace('.', ',')} %`);
  if (entry.reference) parts.push(`Réf. ${entry.reference}`);
  if (entry.note) parts.push(entry.note);

  return {
    title,
    effect: signed(commission),
    direction: commission > 0 ? 'up' : commission < 0 ? 'down' : 'none',
    cash: cash === 0 ? null : `Espèces ${signed(cash)}`,
    detail: parts.length ? parts.join(' · ') : null,
  };
}

/** A page added to the ones already read: a line that is in both is kept once, and the newest stays first. */
export function appendEntries(current: readonly LedgerEntry[], next: readonly LedgerEntry[]): LedgerEntry[] {
  const seen = new Set(current.map((entry) => entry.id));

  return [...current, ...next.filter((entry) => !seen.has(entry.id))].sort((a, b) => b.id - a.id);
}
