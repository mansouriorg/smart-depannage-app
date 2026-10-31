import type { LedgerPage } from './cash';
import { amountOf, dayText, hourText, moneyText } from './customer';
import { apiErrorStatus } from './errors';
import { readAmount } from './money';
import type { StatusTone } from './status';

/**
 * The finance console (P2-08): what the people who handle money read to reconcile a week, and the rules the screens share. The
 * server side is `smart-depannage-serveur` (src/modules/finance); the actions the buttons call stay on the payments, invoices,
 * business and cash-ledger routes. Written by hand, like `cash.ts`.
 *
 * Amounts reach the screens in dinars, up to three decimals; the sums here are made on whole millimes.
 */

// ----------------------------------------------------------
// The tabs and the words
// ----------------------------------------------------------

export const PAYMENT_VIEWS = ['all', 'awaiting', 'received', 'refunded'] as const;
export type PaymentView = (typeof PAYMENT_VIEWS)[number];

export const PAYMENT_VIEW_LABELS: Record<PaymentView, string> = {
  awaiting: 'À confirmer',
  received: 'Reçus',
  refunded: 'Remboursés',
  all: 'Tous',
};

export const INVOICE_VIEWS = ['all', 'unpaid', 'credited'] as const;
export type InvoiceView = (typeof INVOICE_VIEWS)[number];

export const INVOICE_VIEW_LABELS: Record<InvoiceView, string> = {
  all: 'Toutes',
  unpaid: 'Impayées',
  credited: 'Avec avoir',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Demandé',
  AWAITING_CONFIRMATION: 'À confirmer',
  PAID: 'Reçu',
  FAILED: 'Échoué',
  REFUNDED: 'Remboursé',
  PARTIALLY_REFUNDED: 'Remboursé en partie',
  CANCELLED: 'Annulé',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  BANK_TRANSFER: 'Virement',
  ONLINE: 'En ligne',
  ONLINE_CARD: 'Carte',
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  ISSUED: 'Émise',
  SENT: 'Envoyée',
  PAID: 'Payée',
  CANCELLED: 'Annulée',
};

const wordOf = (labels: Record<string, string>, value: string | null | undefined) => (value ? (labels[value] ?? value) : '');

/** The status of a payment as the finance screens write it; the code itself for a status this table does not know. */
export const paymentStatusLabel = (status: string | null | undefined) => wordOf(PAYMENT_STATUS_LABELS, status);
export const paymentMethodLabel = (method: string | null | undefined) => wordOf(PAYMENT_METHOD_LABELS, method);
export const invoiceStatusLabel = (status: string | null | undefined) => wordOf(INVOICE_STATUS_LABELS, status);

const PAYMENT_TONES: Record<string, StatusTone> = {
  PENDING: 'waiting',
  AWAITING_CONFIRMATION: 'warning',
  PAID: 'success',
  FAILED: 'danger',
  REFUNDED: 'info',
  PARTIALLY_REFUNDED: 'info',
  CANCELLED: 'waiting',
};

const INVOICE_TONES: Record<string, StatusTone> = { DRAFT: 'waiting', ISSUED: 'warning', SENT: 'warning', PAID: 'success', CANCELLED: 'danger' };

export const paymentTone = (status: string | null | undefined): StatusTone => PAYMENT_TONES[String(status)] ?? 'waiting';
export const invoiceTone = (status: string | null | undefined): StatusTone => INVOICE_TONES[String(status)] ?? 'waiting';

// ----------------------------------------------------------
// What the server answers
// ----------------------------------------------------------

export interface FinancePeriodQuery {
  /** First day, YYYY-MM-DD, on the clock of Tunis. */
  from?: string;
  /** Last day, YYYY-MM-DD, included. */
  to?: string;
}

export interface FinancePageQuery extends FinancePeriodQuery {
  page?: number;
  limit?: number;
  /** A job number, a payment number, a reference, a receipt or invoice number, a customer's name or phone. */
  search?: string;
}

export interface FinancePaymentsQuery extends FinancePageQuery {
  view?: PaymentView;
  status?: string;
  method?: string;
  /** Only the payments of this job (the complaint screen links to them), whatever their date. */
  interventionId?: number;
  sort?: 'newest' | 'oldest';
}

export interface FinanceInvoicesQuery extends FinancePageQuery {
  view?: InvoiceView;
  status?: string;
}

/** The export takes the filters of the list and none of its paging. */
export interface FinancePaymentsExportQuery extends FinancePeriodQuery {
  view?: PaymentView;
  status?: string;
  method?: string;
  interventionId?: number;
  search?: string;
}

export interface FinancePage<Row> {
  items: Row[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  /**
   * The sum the tab is about over every row of the filter, in the currency of the company. Payments: what is asked ("awaiting"),
   * what came in ("received"), what went back ("refunded"); null in the tab of all, where payments that failed or were cancelled
   * do not add up. Invoices: what is left to pay ("unpaid"); in the others what they ask less their credit notes.
   */
  amount: number | null;
  /** `explicit`: a period was named. `applied`: it limited this list (what waits is shown whatever the date). */
  period: { from: string; to: string; explicit: boolean; applied: boolean };
}

export interface PaymentRow {
  id: number;
  interventionId: number;
  method: string;
  provider: string;
  status: string;
  amount: number;
  amountRefunded: number;
  /** What can still be given back on it. */
  refundable: number;
  currency: string;
  reference: string | null;
  receiptNumber: string | null;
  adminNote: string | null;
  /** The number the card provider gave to the payment (P2-10): how it is found at the provider. Null for cash, a transfer, and a card request the provider never took. */
  providerReference: string | null;
  /** When the time to pay a card payment ends. */
  expiresAt: string | null;
  /** Why it failed, was cancelled or was refunded, whichever applies. */
  reason: string | null;
  requestedAt: string | null;
  confirmedAt: string | null;
  failedAt: string | null;
  refundedAt: string | null;
  cancelledAt: string | null;
  invoice: { id: number; number: string; status: string } | null;
  job: { id: number; status: string; serviceType: string | null };
  client: { id: number; name: string | null; phone: string | null } | null;
  artisan: { id: number; name: string | null } | null;
  /** The cash an artisan said they took for it and nobody has taken back. */
  declared: { artisanId: number; amount: number } | null;
}

export interface CreditNoteRow {
  id: number;
  number: string;
  amountTTC: number;
  stampDuty: number;
  reason: string;
  issuedAt: string | null;
}

export interface InvoiceRow {
  id: number;
  interventionId: number;
  number: string;
  status: string;
  paymentStatus: string;
  currency: string;
  amountHT: number;
  taxAmount: number;
  amountTTC: number;
  stampDuty: number;
  credited: number;
  toPay: number;
  received: number;
  /** What is still to pay; 0 for a cancelled invoice; null in another currency than the company's. */
  left: number | null;
  clientName: string | null;
  clientPhone: string | null;
  mentionsConfirmed: boolean;
  cancelReason: string | null;
  issuedAt: string | null;
  sentAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  creditNotes: CreditNoteRow[];
}

export interface MethodTotal {
  method: string;
  count: number;
  amount: number;
}

export interface DayTotal {
  day: string;
  received: number;
  refunded: number;
  count: number;
}

export interface FinanceSummary {
  currency: string;
  period: { from: string; to: string; days: number };
  awaiting: { count: number; amount: number; oldestAt: string | null; byMethod: MethodTotal[] };
  received: { count: number; amount: number; byMethod: MethodTotal[] };
  refunded: { count: number; amount: number };
  net: number;
  days: DayTotal[];
  invoices: {
    issued: { count: number; total: number };
    creditNotes: { count: number; total: number };
    unpaid: { count: number; left: number };
  };
  refundsDue: { count: number; amount: number };
  cash: { artisansOwing: number; commissionOwed: number; cashCollected: number };
  payouts: { open: { count: number; net: number }; paid: { count: number; net: number } };
}

export interface RefundablePayment {
  id: number;
  method: string;
  status: string;
  amount: number;
  refundable: number;
  confirmedAt: string | null;
}

export interface RefundDueRow {
  interventionId: number;
  client: { id: number; name: string | null; phone: string | null } | null;
  invoice: { id: number; number: string } | null;
  creditNotes: Array<{ id: number; number: string; amount: number; issuedAt: string | null }>;
  kept: number;
  owed: number;
  due: number;
  /** The complaints whose refund was accepted and has not all gone back (P2-09): what was accepted, what is left, and when it was decided. */
  complaints: Array<{ id: number; title: string; accepted: number; remaining: number; decidedAt: string | null }>;
  /** What the credit notes leave to give back, what the accepted complaints leave, and what a cancelled job still holds: `due` is the largest of the three, never their sum. */
  fromCreditNotes: number;
  fromComplaints: number;
  /** What a cancelled job holds that the standing invoice does not ask (P3-01); 0 when the job is not cancelled. */
  fromCancellation: number;
  /** When and why the job was cancelled, for a job that owes because of the cancellation (`fromCancellation` above 0); null for any other job, a cancelled one that owes nothing included. */
  cancelled: { at: string | null; reason: string | null } | null;
  payments: RefundablePayment[];
  since: string | null;
}

export interface RefundsDue {
  items: RefundDueRow[];
  total: number;
  amount: number;
}

/** One artisan of GET /cash-ledger/balances. */
export interface ArtisanBalance {
  artisanId: number;
  name: string | null;
  phone: string | null;
  currency: string;
  cashCollected: number;
  commissionDue: number;
  commissionRemitted: number;
  balance: number;
}

// ----------------------------------------------------------
// Days and periods (the clock of Tunis)
// ----------------------------------------------------------

const DAY_TEXT = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The longest period the server reads. */
export const MAX_PERIOD_DAYS = 93;

/** True for a day of the calendar written YYYY-MM-DD (the 31st of November is not). */
export function isDay(text: unknown): text is string {
  const match = typeof text === 'string' ? DAY_TEXT.exec(text) : null;

  if (!match) return false;

  const probe = new Date(0);

  probe.setUTCFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  return probe.getUTCFullYear() === Number(match[1]) && probe.getUTCMonth() === Number(match[2]) - 1 && probe.getUTCDate() === Number(match[3]);
}

const daysSinceEpoch = (day: string) => {
  const [year, month, date] = day.split('-').map(Number);
  const probe = new Date(0);

  probe.setUTCFullYear(year, month - 1, date);

  return Math.round(probe.getTime() / 86_400_000);
};

/** The day `count` days after (or, negative, before) a day. */
export function shiftDay(day: string, count: number): string {
  const [year, month, date] = day.split('-').map(Number);
  const moved = new Date(0);

  moved.setUTCFullYear(year, month - 1, date + count);

  return `${String(moved.getUTCFullYear()).padStart(4, '0')}-${String(moved.getUTCMonth() + 1).padStart(2, '0')}-${String(moved.getUTCDate()).padStart(2, '0')}`;
}

/** The number of days from `from` to `to`, both included. */
export function daysIn(from: string, to: string): number {
  return daysSinceEpoch(to) - daysSinceEpoch(from) + 1;
}

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Today's date in Tunis, YYYY-MM-DD (the server's day is the clock of the company, not of the browser). */
export function businessToday(now: Date = new Date()): string {
  return TODAY.format(now);
}

/** 0 for Monday up to 6 for Sunday. */
function weekdayIndex(day: string): number {
  return (daysSinceEpoch(day) + 3) % 7;
}

export interface DayRange {
  from: string;
  to: string;
}

/** The week (Monday to Sunday) that holds this day, `weeksAgo` weeks back. */
export function weekRange(today: string, weeksAgo = 0): DayRange {
  const monday = shiftDay(today, -weekdayIndex(today) - 7 * weeksAgo);

  return { from: monday, to: shiftDay(monday, 6) };
}

/** The last `count` days, today included. */
export function lastDays(today: string, count: number): DayRange {
  return { from: shiftDay(today, -(count - 1)), to: today };
}

/** The calendar month that holds this day, `monthsAgo` months back. */
export function monthRange(today: string, monthsAgo = 0): DayRange {
  const [year, month] = today.split('-').map(Number);
  const index = year * 12 + (month - 1) - monthsAgo;
  const first = `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}-01`;
  const next = shiftDay(first, 31);
  const afterMonth = `${next.slice(0, 7)}-01`;

  return { from: first, to: shiftDay(afterMonth, -1) };
}

export interface PeriodChoice extends DayRange {
  id: 'week' | 'last-week' | 'seven-days' | 'month' | 'last-month';
  label: string;
}

/** The periods the picker offers, for a given today. A period of the current week or month stops today only on the server's side: the days to come are empty. */
export function periodChoices(today: string): PeriodChoice[] {
  return [
    { id: 'week', label: 'Cette semaine', ...weekRange(today) },
    { id: 'last-week', label: 'Semaine dernière', ...weekRange(today, 1) },
    { id: 'seven-days', label: '7 derniers jours', ...lastDays(today, 7) },
    { id: 'month', label: 'Ce mois-ci', ...monthRange(today) },
    { id: 'last-month', label: 'Mois dernier', ...monthRange(today, 1) },
  ];
}

/** The choice that a period is, or null when it is a period of the person's own. */
export function choiceOf(today: string, from: string | undefined, to: string | undefined): PeriodChoice['id'] | null {
  return periodChoices(today).find((choice) => choice.from === from && choice.to === to)?.id ?? null;
}

/**
 * The days a period names, as the server reads them: both ends; or seven days from the first day; or seven days up to the last;
 * null when neither is given.
 */
export function periodDays(from: string | undefined, to: string | undefined): DayRange | null {
  const first = from?.trim() ? from.trim() : null;
  const last = to?.trim() ? to.trim() : null;

  if (first && last) return { from: first, to: last };
  if (first) return { from: first, to: shiftDay(first, 6) };
  if (last) return { from: shiftDay(last, -6), to: last };

  return null;
}

/**
 * Whether a moment falls in a period, by its day on the clock of Tunis. A period with nothing in it holds every moment; a moment
 * with no date (or one that is not a date) is in no period.
 */
export function inPeriod(moment: string | null | undefined, from: string | undefined, to: string | undefined): boolean {
  const days = periodDays(from, to);

  if (!days) return true;
  if (!moment) return false;

  const at = new Date(moment);

  if (Number.isNaN(at.getTime())) return false;

  const day = businessToday(at);

  return day >= days.from && day <= days.to;
}

/** The sum of amounts that come as numbers or as the text of a DECIMAL column, in dinars (made on whole millimes). */
export function sumAmounts(values: ReadonlyArray<number | string>): number {
  return values.reduce<number>((total, value) => total + amountOf(value), 0) / 1000;
}

/** Why a period cannot be asked for (the server refuses it with the same words), or null when it can. A period left empty is fine. */
export function periodProblem(from: string | undefined, to: string | undefined): string | null {
  const first = from?.trim() ? from.trim() : null;
  const last = to?.trim() ? to.trim() : null;

  if (first && !isDay(first)) return 'La date « du » n’est pas un jour du calendrier (AAAA-MM-JJ).';
  if (last && !isDay(last)) return 'La date « au » n’est pas un jour du calendrier (AAAA-MM-JJ).';
  if (first && last && first > last) return 'Période invalide : le premier jour est après le dernier.';
  if (first && last && daysIn(first, last) > MAX_PERIOD_DAYS) return `La période ne peut pas dépasser ${MAX_PERIOD_DAYS} jours.`;

  return null;
}

/** "24 octobre 2026", or "19 octobre 2026 au 25 octobre 2026". */
export function periodText(from: string, to: string): string {
  const start = dayText(`${from}T12:00:00Z`) ?? from;
  const end = dayText(`${to}T12:00:00Z`) ?? to;

  return from === to ? start : `${start} au ${end}`;
}

/** A day as the tables write it: "20/10". */
export function shortDay(day: string): string {
  const match = DAY_TEXT.exec(day);

  return match ? `${match[3]}/${match[2]}` : day;
}

// ----------------------------------------------------------
// Queries
// ----------------------------------------------------------

/** The parameters of a query without the ones left empty: a blank date is not a date, and the server would refuse it. */
export function financeParams<Query extends object>(query: Query): Record<string, string | number> {
  const out: Record<string, string | number> = {};

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;

    if (typeof value === 'string') {
      const text = value.trim();

      if (text !== '') out[key] = text;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value;
    }
  }

  return out;
}

// ----------------------------------------------------------
// What a row lets the team do
// ----------------------------------------------------------

export type PaymentAction = 'confirm' | 'fail' | 'cancel' | 'refund' | 'check';

export const PAYMENT_ACTION_LABELS: Record<PaymentAction, string> = {
  confirm: 'Confirmer la réception',
  fail: 'Marquer échoué',
  cancel: 'Annuler',
  refund: 'Rembourser',
  check: 'Vérifier auprès du prestataire',
};

/**
 * A payment asked for and not decided that the team can decide: one that waits for confirmation, or a cash or transfer request
 * (PENDING). A card request that is PENDING is not for the team to decide: either the provider has it (the server settles it from the
 * provider's answer) or it never reached the provider (nobody can pay it). It is not in the queue of the payments to confirm (the
 * server leaves it out of the same list).
 */
export function isAwaiting(payment: Pick<PaymentRow, 'status'> & { method?: string | null }): boolean {
  return payment.status === 'AWAITING_CONFIRMATION' || (payment.status === 'PENDING' && isManualMethod(payment.method));
}

type Carded = Pick<PaymentRow, 'status'> & { method?: string | null; providerReference?: string | null };

/** A card payment the provider has: it has a number there. */
export function isAtProvider(payment: Pick<PaymentRow, 'status'> & { method?: string | null; providerReference?: string | null }): boolean {
  return !isManualMethod(payment.method) && typeof payment.providerReference === 'string' && payment.providerReference !== '';
}

/**
 * A card payment that holds money the system did not count by itself (it came late, or not as asked, or the job was cancelled): the
 * provider has the customer's money, and the team decides. Only a card payment can be in this state at the provider.
 */
export function isMoneyAtProvider(payment: Carded): boolean {
  return payment.status === 'AWAITING_CONFIRMATION' && isAtProvider(payment);
}

/** A card request that nobody can pay because the provider never took it: the team can only clear it (the server's timer clears it too). */
export function isPlaceholder(payment: Carded): boolean {
  return payment.status === 'PENDING' && !isManualMethod(payment.method) && !isAtProvider(payment);
}

/** A payment the team enters by hand: its money does not come through a provider that would say it failed. */
export function isManualMethod(method: string | null | undefined): boolean {
  return method === 'CASH' || method === 'BANK_TRANSFER';
}

/**
 * Whether a failed call may have been carried out all the same: no answer came (the network went, the request timed out) or the
 * server failed (5xx) after it may have begun. A refusal (4xx) changed nothing. A repeated refund of an amount is accepted by the
 * server up to the total of the payment, so the console does not offer to send it again before the person has looked, unless the
 * call carries a key (P2-10): then the server answers the repeat as it answered the first call.
 */
export function outcomeIsUnknown(error: unknown): boolean {
  const status = apiErrorStatus(error);

  return status === null || status >= 500;
}

/**
 * The buttons a payment row offers: decide it while it waits; give money back while some of it can still go back. A cash or
 * transfer payment marked as failed by mistake can be confirmed again (the server allows it), so that the team can put it right.
 * A card payment at the provider can be looked at again (the provider is asked, and the payment follows its answer) and, while it
 * waits, cancelled; one that was cancelled or refused can be looked at once more, because money may still come for it.
 */
export function paymentActions(payment: Carded & Pick<PaymentRow, 'refundable'>): PaymentAction[] {
  if (isAwaiting(payment)) return ['confirm', 'fail', 'cancel'];
  if (isPlaceholder(payment)) return ['cancel'];
  if (isAtProvider(payment) && payment.status === 'PENDING') return ['check', 'cancel'];
  if (isAtProvider(payment) && (payment.status === 'CANCELLED' || payment.status === 'FAILED')) return ['check'];
  if (payment.status === 'FAILED' && isManualMethod(payment.method)) return ['confirm'];

  return payment.refundable > 0 && (payment.status === 'PAID' || payment.status === 'PARTIALLY_REFUNDED') ? ['refund'] : [];
}

/** The sentence under a payment that waits: who is to decide it, and what the artisan said. */
export function waitingWords(payment: Pick<PaymentRow, 'method' | 'status' | 'declared' | 'reference'> & { providerReference?: string | null; expiresAt?: string | null }): string | null {
  // A request of the customer is cleared by the system after a quarter of an hour; one entered by the team (an online payment to count by
  // hand) is left to the team: it is not told which here.
  if (isPlaceholder(payment)) return 'Demande de paiement en ligne qui n’est pas parvenue au prestataire : personne n’a pu la payer. Le système annule celle du client au bout d’un quart d’heure ; une demande saisie par l’équipe reste à annuler.';

  if (isMoneyAtProvider(payment)) return CARD_MONEY_WORDS.waiting;

  if (payment.status === 'PENDING' && isAtProvider(payment)) {
    const ends = hourText(payment.expiresAt);

    return `Paiement par carte en attente chez le prestataire${ends ? `, à terminer avant ${ends}` : ''}. Il est compté dès que le prestataire confirme : rien à faire.`;
  }

  if (!isAwaiting(payment)) return null;

  const parts: string[] = [];

  if (payment.declared) parts.push(`L’artisan déclare avoir encaissé ${moneyText(payment.declared.amount)}.`);
  if (payment.method === 'BANK_TRANSFER') parts.push(payment.reference ? `Référence du virement : ${payment.reference}.` : 'Pas encore de référence de virement.');

  return parts.length > 0 ? parts.join(' ') : null;
}

/** Where a payment stands after the check, in words for the person who asked (the payment as the server gives it back; the words do not say who decided it). */
export function checkOutcomeWords(payment: { status?: string | null } | null | undefined): string {
  switch (payment?.status) {
    case 'PAID':
    case 'PARTIALLY_REFUNDED':
    case 'REFUNDED':
      return 'Le paiement est reçu.';
    case 'AWAITING_CONFIRMATION':
      return 'L’argent est arrivé chez le prestataire, mais le paiement est à vérifier (voir la note) avant de le confirmer ou de rembourser.';
    case 'FAILED':
      return 'Le paiement est marqué comme échoué.';
    case 'CANCELLED':
      return 'Le paiement est annulé.';
    case 'PENDING':
      return 'Le prestataire répond que le paiement est encore en attente.';
    default:
      return 'La vérification est faite.';
  }
}

/** What the team is told about a card payment whose money the provider holds: how to decide it, and what closing it means. */
export const CARD_MONEY_WORDS = {
  waiting: 'L’argent de ce paiement par carte est arrivé chez le prestataire, mais il n’a pas été compté (voir la note). Confirmez-le pour le compter ; fermez-le seulement si vous l’avez déjà rendu au client chez le prestataire.',
  close: 'Attention : l’argent de ce paiement est chez le prestataire. Le fermer ne le rend pas au client et le paiement ne sera plus jamais compté si l’argent est revu. Fermez-le seulement si l’argent a déjà été rendu au client depuis l’espace du prestataire ; sinon, confirmez-le puis remboursez-le.',
  refund: 'Paiement par carte : le remboursement est enregistré ici, mais il n’est pas envoyé au prestataire. L’argent doit être rendu depuis l’espace du prestataire de paiement.',
  refunded: 'Remboursement enregistré. Il reste à rendre l’argent au client depuis l’espace du prestataire de paiement : rien n’a été envoyé d’ici.',
};

/** The sentence when a refund was sent again and the server answered the one it had already made: nothing more went back. */
export const REFUND_REPLAYED_WORDS = 'Ce remboursement avait déjà été enregistré (le même envoi, répété) : rien n’a été remboursé de plus.';

export type RefundRead = { ok: true; millimes: number } | { ok: false; message: string };

/** An amount typed to be at most `most` dinars, more than nothing, with up to three decimals; the words of a refusal are the screen's. */
function readUpTo(text: unknown, most: number): RefundRead {
  const read = readAmount(text, Math.max(most, 1));

  if (!read.ok) {
    if (read.problem === 'too-big') return { ok: false, message: `Au plus ${moneyText(most)}.` };
    if (read.problem === 'decimals') return { ok: false, message: 'Au plus trois décimales.' };

    return { ok: false, message: 'Saisissez un montant en dinars, par exemple 12,500.' };
  }

  if (read.millimes <= 0) return { ok: false, message: 'Le montant doit être supérieur à zéro.' };

  return read.millimes > amountOf(most) ? { ok: false, message: `Au plus ${moneyText(most)}.` } : { ok: true, millimes: read.millimes };
}

/** The amount typed to give back: more than nothing, at most what can still go back, up to three decimals. An empty field means "all that can go back". */
export function readRefundAmount(text: unknown, refundable: number): RefundRead {
  if (typeof text === 'string' && text.trim() === '') {
    const all = amountOf(refundable);

    return all > 0 ? { ok: true, millimes: all } : { ok: false, message: 'Il ne reste rien à rembourser sur ce paiement.' };
  }

  return readUpTo(text, refundable);
}

/** The amount an artisan hands over (a remittance): required, more than nothing, at most what they owe. */
export function readRemittanceAmount(text: unknown, owed: number): RefundRead {
  if (amountOf(owed) <= 0) return { ok: false, message: 'Cet artisan ne doit rien à la plateforme.' };
  if (typeof text !== 'string' || text.trim() === '') return { ok: false, message: 'Saisissez le montant remis.' };

  return readUpTo(text, owed);
}

/** An invoice that stands (issued, sent or paid) can be credited; a draft is not an invoice yet, and a cancelled one has been credited in full or withdrawn. */
export function canCreditNote(invoice: Pick<InvoiceRow, 'status'>): boolean {
  return invoice.status === 'ISSUED' || invoice.status === 'SENT' || invoice.status === 'PAID';
}

export type CreditNoteRead = { ok: true; body: { reason: string; amountTTC?: number } } | { ok: false; message: string };

/** The longest reason the server keeps on a credit note, and the shortest. */
export const CREDIT_REASON_MIN = 3;
export const CREDIT_REASON_MAX = 500;

/**
 * The body of a credit note from what was typed: the reason the customer will read (3 to 500 characters), and the amount with VAT.
 * An empty amount means "all that is left on the invoice"; the server checks what is left and says why when it is too much.
 */
export function readCreditNote(reason: unknown, amountText: unknown): CreditNoteRead {
  const why = typeof reason === 'string' ? reason.trim() : '';

  if (why.length < CREDIT_REASON_MIN) return { ok: false, message: `Écrivez le motif de l’avoir (au moins ${CREDIT_REASON_MIN} caractères): le client le lira.` };
  if (why.length > CREDIT_REASON_MAX) return { ok: false, message: `Le motif ne peut pas dépasser ${CREDIT_REASON_MAX} caractères.` };

  // Nothing typed means "all that is left"; something that is not text (a number kept in the form's state, say) is not nothing.
  if (amountText === undefined || amountText === null || (typeof amountText === 'string' && amountText.trim() === '')) return { ok: true, body: { reason: why } };
  if (typeof amountText !== 'string') return { ok: false, message: 'Saisissez un montant en dinars, par exemple 12,500, ou laissez vide pour tout ce qui reste.' };

  const read = readAmount(amountText);

  if (!read.ok) {
    if (read.problem === 'decimals') return { ok: false, message: 'Au plus trois décimales.' };
    if (read.problem === 'too-big') return { ok: false, message: 'Ce montant est trop grand.' };

    return { ok: false, message: 'Saisissez un montant en dinars, par exemple 12,500, ou laissez vide pour tout ce qui reste.' };
  }

  return read.millimes <= 0 ? { ok: false, message: 'Le montant doit être supérieur à zéro.' } : { ok: true, body: { reason: why, amountTTC: read.millimes / 1000 } };
}

export interface RefundStep {
  paymentId: number;
  /** In whole millimes. */
  millimes: number;
}

/**
 * How to give back `due` over the payments of a job: the latest payment first, each as far as it can go back. Nothing more than
 * is due, nothing more than a payment can return; the steps add up to the smaller of `due` and what can go back in all.
 */
export function refundPlan(due: number, payments: ReadonlyArray<Pick<RefundablePayment, 'id' | 'refundable'>>): RefundStep[] {
  let left = amountOf(due);
  const steps: RefundStep[] = [];

  for (const payment of [...payments].reverse()) {
    if (left <= 0) break;

    const room = amountOf(payment.refundable);
    const take = Math.min(room, left);

    if (take > 0) {
      steps.push({ paymentId: payment.id, millimes: take });
      left -= take;
    }
  }

  return steps;
}

// ----------------------------------------------------------
// The checks of the week
// ----------------------------------------------------------

const sumMillimes = (values: readonly number[]) => values.reduce((total, value) => total + amountOf(value), 0);

/**
 * What does not add up in the summary of a week, as sentences (an empty list when everything does): the days against the totals,
 * the methods against the total, the net against the two. The server builds all of them from the same payments, so a sentence
 * here is a thing to look at before trusting the screen.
 */
export function summaryProblems(summary: FinanceSummary): string[] {
  const problems: string[] = [];
  const unit = summary.currency;

  if (sumMillimes(summary.days.map((day) => day.received)) !== amountOf(summary.received.amount)) problems.push('Les jours ne totalisent pas le montant reçu de la période.');
  if (sumMillimes(summary.days.map((day) => day.refunded)) !== amountOf(summary.refunded.amount)) problems.push('Les jours ne totalisent pas le montant remboursé de la période.');
  if (summary.days.reduce((total, day) => total + day.count, 0) !== summary.received.count) problems.push('Les jours ne comptent pas autant de paiements que la période.');
  if (sumMillimes(summary.received.byMethod.map((method) => method.amount)) !== amountOf(summary.received.amount)) problems.push('Les modes de paiement ne totalisent pas le montant reçu.');
  if (amountOf(summary.received.amount) - amountOf(summary.refunded.amount) !== amountOf(summary.net)) problems.push(`Le net n’est pas le reçu moins le remboursé (${unit}).`);
  if (sumMillimes(summary.awaiting.byMethod.map((method) => method.amount)) !== amountOf(summary.awaiting.amount)) problems.push('Les modes de paiement en attente ne totalisent pas le montant en attente.');

  return problems;
}

/** The lines of the reconciliation of the period: received, given back, net. */
export function reconciliationLines(summary: FinanceSummary): Array<{ label: string; amount: number; count: number | null; strong: boolean }> {
  return [
    { label: 'Reçu', amount: summary.received.amount, count: summary.received.count, strong: false },
    { label: 'Remboursé', amount: -Math.abs(summary.refunded.amount), count: summary.refunded.count, strong: false },
    { label: 'Net de la période', amount: summary.net, count: null, strong: true },
  ];
}

/** True when there is something waiting for the team: a payment to decide, a refund to make. */
export function needsAttention(summary: Pick<FinanceSummary, 'awaiting' | 'refundsDue'>): boolean {
  return summary.awaiting.count > 0 || summary.refundsDue.count > 0;
}

/** "3 paiements, 350,000 DT" and the like. */
export function countText(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

// ----------------------------------------------------------
// Payouts and the cash of the artisans
// ----------------------------------------------------------

export type PayoutStatus = 'PENDING' | 'READY' | 'PAID' | 'FAILED' | 'CANCELLED';

export const PAYOUT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'En préparation',
  READY: 'Prêt à payer',
  PAID: 'Payé',
  FAILED: 'Échoué',
  CANCELLED: 'Annulé',
};

export const payoutStatusLabel = (status: string | null | undefined) => wordOf(PAYOUT_STATUS_LABELS, status);

const PAYOUT_TONES: Record<string, StatusTone> = { PENDING: 'waiting', READY: 'warning', PAID: 'success', FAILED: 'danger', CANCELLED: 'waiting' };

export const payoutTone = (status: string | null | undefined): StatusTone => PAYOUT_TONES[String(status)] ?? 'waiting';

/** A payout as GET /business/payouts lists it (the amounts are the text of a DECIMAL column). */
export interface PayoutRow {
  id: number;
  artisanId: number;
  status: PayoutStatus;
  periodStart: string;
  periodEnd: string;
  currency: string;
  grossAmount: number | string;
  paymentProviderFees: number | string;
  refundsDeducted: number | string;
  netAmount: number | string;
  paymentReference: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  artisan: { id: number; name: string | null; email?: string | null; phone: string | null } | null;
  items: Array<{ id: number; interventionId: number; amount: number | string }>;
}

export type PayoutHold = 'OPEN_DISPUTE' | 'REFUND' | 'PAID_IN_CASH' | 'NOT_FINISHED' | 'NOT_PAID';

export const PAYOUT_HOLD_WORDS: Record<PayoutHold, string> = {
  OPEN_DISPUTE: 'Réclamation en cours',
  REFUND: 'Remboursement en cours ou pas encore enregistré',
  PAID_IN_CASH: 'Espèces déjà encaissées par l’artisan',
  NOT_FINISHED: 'Travail non terminé',
  NOT_PAID: 'Le client n’a pas tout payé',
};

/** The reasons a job is left out of a payout, in words. A reason this table does not know is shown as it is. */
export function holdWords(reasons: ReadonlyArray<string>): string {
  return reasons.map((reason) => PAYOUT_HOLD_WORDS[reason as PayoutHold] ?? reason).join(' · ');
}

/** GET /business/payouts/preview: what a payout would pay and what it would leave out. */
export interface PayoutPreview {
  artisanId: number;
  periodStart: string;
  periodEnd: string;
  currency: string;
  grossAmount: number;
  included: Array<{ financialId: number; interventionId: number; amount: number; cashHeld: number }>;
  held: Array<{ financialId: number; interventionId: number; amount: number; reasons: PayoutHold[] }>;
}

export interface PayoutPeriodQuery {
  artisanId: number;
  periodStart: string;
  periodEnd: string;
}

/**
 * The two ends of a payout's period from two days: the first instant of the first day to the last second of the last, on the
 * clock of Tunis (a date alone would be read as midnight in UTC, an hour after the day began).
 */
export function payoutPeriod(from: string, to: string): { periodStart: string; periodEnd: string } {
  return { periodStart: `${from}T00:00:00`, periodEnd: `${to}T23:59:59` };
}

/** The longest reason the server keeps for a decision on a payment (a failure, a cancellation, a refund), and the longest transfer reference it keeps on a confirmation. */
export const PAYMENT_REASON_MAX = 500;
export const CONFIRM_REFERENCE_MAX = 200;

/** The shortest and longest reason the console takes for a decision on a payment (the server keeps up to 500 characters). */
export const REASON_MIN = 3;
export const NOTE_MAX = 500;

export type ReasonRead = { ok: true; reason: string } | { ok: false; message: string };

/** The reason typed for failing, cancelling or refunding a payment: required, so that the payment says why it was decided, three to 500 characters. */
export function readReason(text: unknown): ReasonRead {
  const reason = typeof text === 'string' ? text.trim() : '';

  if (reason.length < REASON_MIN) return { ok: false, message: `Écrivez le motif (au moins ${REASON_MIN} caractères).` };
  if (reason.length > PAYMENT_REASON_MAX) return { ok: false, message: `Le motif ne peut pas dépasser ${PAYMENT_REASON_MAX} caractères.` };

  return { ok: true, reason };
}

export type ConfirmationRead = { ok: true; body: { reference?: string; adminNote?: string } } | { ok: false; message: string };

/** What is typed to confirm that money arrived: the reference of the transfer or receipt, and a note for the team; both optional. */
export function readConfirmation(reference: unknown, note: unknown): ConfirmationRead {
  const ref = typeof reference === 'string' ? reference.trim() : '';
  const adminNote = typeof note === 'string' ? note.trim() : '';
  const body: { reference?: string; adminNote?: string } = {};

  if (ref.length > CONFIRM_REFERENCE_MAX) return { ok: false, message: `La référence ne peut pas dépasser ${CONFIRM_REFERENCE_MAX} caractères.` };
  if (adminNote.length > NOTE_MAX) return { ok: false, message: `La note ne peut pas dépasser ${NOTE_MAX} caractères.` };
  if (ref !== '') body.reference = ref;
  if (adminNote !== '') body.adminNote = adminNote;

  return { ok: true, body };
}

/** The longest reference and note the server keeps on a remittance. */
export const REMITTANCE_REFERENCE_MAX = 120;

export type RemittanceRead = { ok: true; millimes: number; body: Omit<RemittanceBody, 'requestKey'> } | { ok: false; message: string };

/** What is typed when an artisan hands commission over: the amount (at most what they owe), the number of the transfer or receipt, a note. */
export function readRemittance(amountText: unknown, owed: number, reference: unknown, note: unknown): RemittanceRead {
  const amount = readRemittanceAmount(amountText, owed);

  if (!amount.ok) return amount;

  const ref = typeof reference === 'string' ? reference.trim() : '';
  const text = typeof note === 'string' ? note.trim() : '';

  if (ref.length > REMITTANCE_REFERENCE_MAX) return { ok: false, message: `La référence ne peut pas dépasser ${REMITTANCE_REFERENCE_MAX} caractères.` };
  if (text.length > NOTE_MAX) return { ok: false, message: `La note ne peut pas dépasser ${NOTE_MAX} caractères.` };

  const body: Omit<RemittanceBody, 'requestKey'> = { amount: amount.millimes / 1000 };

  if (ref !== '') body.reference = ref;
  if (text !== '') body.note = text;

  return { ok: true, millimes: amount.millimes, body };
}

export type PayoutPaidRead = { ok: true; body: { paymentReference?: string; paidAt?: string } } | { ok: false; message: string };

/**
 * The body that marks a payout as paid, from what was typed: the reference of the transfer (optional), and the day it was made
 * (optional: the server takes the moment of the request). Today is left to the server, so that "today" is never a time that has
 * not come; any earlier day is sent at noon on the clock of Tunis, so that no zone moves it to the day before. A day to come is refused.
 */
export function readPayoutPaid(reference: unknown, day: unknown, today: string): PayoutPaidRead {
  const body: { paymentReference?: string; paidAt?: string } = {};
  const ref = typeof reference === 'string' ? reference.trim() : '';
  const when = typeof day === 'string' ? day.trim() : '';

  if (ref.length > CONFIRM_REFERENCE_MAX) return { ok: false, message: `La référence ne peut pas dépasser ${CONFIRM_REFERENCE_MAX} caractères.` };
  if (ref !== '') body.paymentReference = ref;

  if (when !== '') {
    if (!isDay(when)) return { ok: false, message: 'La date du paiement n’est pas un jour du calendrier (AAAA-MM-JJ).' };
    if (when > today) return { ok: false, message: 'La date du paiement ne peut pas être dans le futur.' };
    if (when < today) body.paidAt = `${when}T12:00:00`;
  }

  return { ok: true, body };
}

export type PayoutAction = 'paid' | 'cancel';

/** What can still be done with a payout: it is paid or cancelled while it waits, and nothing once it is one or the other. */
export function payoutActions(status: string | null | undefined): PayoutAction[] {
  return status === 'PENDING' || status === 'READY' ? ['paid', 'cancel'] : [];
}

/** One artisan's ledger, as GET /cash-ledger/artisans/:id answers it. */
export interface ArtisanLedger extends LedgerPage {
  artisan: { id: number; name: string | null; phone: string | null };
}

export interface RemittanceBody {
  amount: number;
  reference?: string;
  note?: string;
  /** The same key sent twice writes one line. */
  requestKey?: string;
}

/** The artisans that owe the platform something, those who owe the most first. */
export function owingArtisans(balances: readonly ArtisanBalance[]): ArtisanBalance[] {
  return balances.filter((entry) => amountOf(entry.balance) > 0).sort((a, b) => amountOf(b.balance) - amountOf(a.balance) || a.artisanId - b.artisanId);
}

/** What the artisans owe the platform in all, and the cash they hold, in millimes. */
export function cashOverview(balances: readonly ArtisanBalance[]): { owed: number; held: number; owing: number } {
  const owing = owingArtisans(balances);

  return { owed: owing.reduce((sum, entry) => sum + amountOf(entry.balance), 0), held: balances.reduce((sum, entry) => sum + amountOf(entry.cashCollected), 0), owing: owing.length };
}

// ----------------------------------------------------------
// Files
// ----------------------------------------------------------

/**
 * The name of a downloaded file from the `Content-Disposition` header of the answer (`attachment; filename="paiements-all.csv"`),
 * or `fallback` when there is none. Never a path: the separators are replaced, so a name cannot walk out of the downloads folder.
 */
export function filenameFromDisposition(header: unknown, fallback: string): string {
  const text = typeof header === 'string' ? header : '';
  const star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(text);
  const plain = /filename\s*=\s*(?:"([^"]*)"|([^;\s]+))/i.exec(text);
  let name = '';

  try {
    name = star ? decodeURIComponent(star[1]) : (plain?.[1] ?? plain?.[2] ?? '');
  } catch {
    name = '';
  }

  name = name.replace(/[\\/]/g, '_').replace(/[\u0000-\u001f]/g, '').trim();

  return name === '' || name === '.' || name === '..' ? fallback : name;
}
