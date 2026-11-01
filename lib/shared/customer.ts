import { DEFAULT_LOCALE, INTL_TAGS, type Locale } from './generated/i18n';
import { canonicalStatus, type CanonicalStatus } from './generated/intervention-status';
import type { TrackingInterventionInvoice, TrackingInterventionPayment, TrackingInterventionQuote } from './generated/views';
import { message, messageText } from './i18n';
import { formatMillimes, toDinars, toMillimes } from './money';
import type { StatusTone } from './status';
import { charactersText, isolateFor } from './words';

/**
 * What a customer does from the tracking link alone (P2-06): read the quote and answer it, choose how to pay, read and keep the
 * invoice. The server's side is `smart-depannage-serveur` (src/modules/guest, src/modules/quotes/quote-decisions.ts and
 * src/modules/payments/payment-options.ts there); the rules below say the same as it does, so that a button the page shows is one
 * the server accepts. The server has the last word and its sentence is what the page shows when it refuses.
 *
 * Amounts reach the page as the figure of a DECIMAL column (a number, or its text: "119.000"); `amountOf` reads both, in whole
 * millimes, and nothing here adds two dinar amounts as floating-point numbers.
 *
 * Every sentence is in the catalogue (`customer.*`, French and Arabic, P3-04). A function that returns words takes the language as its last
 * argument (`locale`, French when it is left out; the dashboard, which stays French, passes none). A function that returns only a value
 * (an amount, a date) returns it plain, and the screen sets it left to right; a sentence with a value inside sets the value apart itself.
 */

// ----------------------------------------------------------
// Amounts and dates
// ----------------------------------------------------------

/** An amount as the server sent it (a number, or the text of one) in whole millimes; 0 when it is neither. */
export function amountOf(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));

  return Number.isFinite(number) ? toMillimes(number) : 0;
}

/** The unit a screen writes after an amount: "DT" ("د.ت") for the dinar, else the code of the currency. */
export function currencyUnit(currency: string | null | undefined, locale: Locale = DEFAULT_LOCALE): string {
  return !currency || currency === 'TND' ? message(locale, 'money.unit') : currency;
}

/** An amount as the money screens write them: "119,000 DT" ("119,000 د.ت"). */
export function moneyText(value: unknown, currency?: string | null, locale: Locale = DEFAULT_LOCALE): string {
  return formatMillimes(amountOf(value), currencyUnit(currency, locale), locale);
}

/**
 * The tag each language writes its dates with. French keeps `fr-FR`, the tag these dates were always written with; Arabic is read as it is
 * written in Tunisia (`ar-TN`: the months are janvier, février... in Arabic letters) with the digits 0 to 9.
 */
const DATE_TAGS: Record<Locale, string> = { fr: 'fr-FR', ar: INTL_TAGS.ar };

const formatters = new Map<string, Intl.DateTimeFormat>();

/** One formatter for each kind and language, made when it is first needed (a phone may lack a language until it is asked for). */
function formatter(kind: 'day' | 'hour', locale: Locale): Intl.DateTimeFormat {
  const key = `${kind}:${locale}`;
  let found = formatters.get(key);

  if (!found) {
    const options: Intl.DateTimeFormatOptions =
      kind === 'day'
        ? { timeZone: 'Africa/Tunis', day: 'numeric', month: 'long', year: 'numeric' }
        : { timeZone: 'Africa/Tunis', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };

    found = new Intl.DateTimeFormat(DATE_TAGS[locale], locale === 'ar' ? { ...options, numberingSystem: 'latn' } : options);
    formatters.set(key, found);
  }

  return found;
}

/** The hour as people write it in Tunis: "14 h 05" ("14:05"). Null when there is none (or it is not a date). */
export function hourText(iso: string | null | undefined, locale: Locale = DEFAULT_LOCALE): string | null {
  if (!iso) return null;

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return null;

  const text = formatter('hour', locale).format(date);
  const [hour, minute, ...more] = text.split(':');

  return minute !== undefined && more.length === 0 ? message(locale, 'common.time', { hour, minute }) : text;
}

/** A date and its hour as people write them in Tunis: "24 octobre 2026 à 14 h 05". Null when there is no date (or it is not one). */
export function momentText(iso: string | null | undefined, locale: Locale = DEFAULT_LOCALE): string | null {
  const day = dayText(iso, locale);
  const hour = hourText(iso, locale);

  return day && hour ? message(locale, 'common.dateAt', { day, time: hour }) : day;
}

/** A date as people write it in Tunis: "24 octobre 2026". Null when there is none (or it is not a date). */
export function dayText(iso: string | null | undefined, locale: Locale = DEFAULT_LOCALE): string | null {
  if (!iso) return null;

  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? null : formatter('day', locale).format(date);
}

// ----------------------------------------------------------
// The lines and the totals of a quote or an invoice
// ----------------------------------------------------------

type Line = { label: string; description: string | null; quantity: number; unitPrice: number; total: number };

export interface DocumentLine {
  label: string;
  description: string | null;
  quantityText: string;
  unitText: string;
  totalText: string;
}

/** A quantity the way the PDF writes it: up to three decimals, a comma ("2", "1,5", "2,505"). */
export function quantityText(quantity: number | string): string {
  const number = Number(quantity);

  if (!Number.isFinite(number)) return '';

  return String(Math.round(number * 1000) / 1000).replace('.', ',');
}

export function documentLines(items: readonly Line[] | null | undefined, currency?: string | null, locale: Locale = DEFAULT_LOCALE): DocumentLine[] {
  return (items ?? []).map((line) => ({
    label: line.label,
    description: line.description?.trim() ? line.description.trim() : null,
    quantityText: quantityText(line.quantity),
    unitText: moneyText(line.unitPrice, currency, locale),
    totalText: moneyText(line.total, currency, locale),
  }));
}

export interface DocumentTotals {
  subtotalText: string;
  /** "TVA 19 %" */
  taxLabel: string;
  taxText: string;
  totalText: string;
}

export function documentTotals(
  document: { amountHT: number; taxRate: number; taxAmount: number; amountTTC: number; currency?: string | null },
  locale: Locale = DEFAULT_LOCALE,
): DocumentTotals {
  const rate = Number(document.taxRate);

  return {
    subtotalText: moneyText(document.amountHT, document.currency, locale),
    taxLabel: message(locale, 'money.taxLabel', { rate: Number.isFinite(rate) ? String(rate).replace('.', ',') : '0' }),
    taxText: moneyText(document.taxAmount, document.currency, locale),
    totalText: moneyText(document.amountTTC, document.currency, locale),
  };
}

// ----------------------------------------------------------
// The quote
// ----------------------------------------------------------

/** The most a note on a quote can hold (the server's limit). */
export const QUOTE_NOTE_MAX = 500;

/** The statuses of a mission in which its quotes are no longer answered (quote-decisions.ts there: JOB_STATUSES_CLOSED_TO_QUOTES). */
const CLOSED_TO_QUOTES: readonly CanonicalStatus[] = ['CANCELLED', 'DISPUTED', 'COMPLETED', 'PAYMENT_PENDING', 'PAID', 'INVOICE_SENT'];

export interface QuoteWords {
  closedJob: string;
  toAnswer: string;
  beingChanged: string;
  accepted: string;
  refused: string;
  cancelled: string;
  expired: string;
}

/** The sentences of the quote card that do not depend on a date, in a language. */
export function quoteWords(locale: Locale = DEFAULT_LOCALE): QuoteWords {
  return {
    closedJob: message(locale, 'customer.quote.closedJob'),
    toAnswer: message(locale, 'customer.quote.toAnswer'),
    beingChanged: message(locale, 'customer.quote.beingChanged'),
    accepted: message(locale, 'customer.quote.accepted'),
    refused: message(locale, 'customer.quote.refused'),
    cancelled: message(locale, 'customer.quote.cancelled'),
    expired: message(locale, 'customer.quote.expired'),
  };
}

/** The same sentences in French. */
export const QUOTE_WORDS: QuoteWords = quoteWords('fr');

export type CustomerQuoteStage = 'none' | 'to-answer' | 'expired' | 'being-changed' | 'accepted' | 'refused' | 'closed';

export interface CustomerQuote {
  stage: CustomerQuoteStage;
  /** The quote the card talks about: the accepted one, else the one to answer, else the last. */
  quote: TrackingInterventionQuote | null;
  canAccept: boolean;
  canRefuse: boolean;
  canAsk: boolean;
  canRequestChange: boolean;
  /** One sentence for the card. */
  words: string;
}

const NOTHING = { canAccept: false, canRefuse: false, canAsk: false, canRequestChange: false };

/** A quote whose last day has passed: the server refuses to accept it. */
export function isLapsed(quote: Pick<TrackingInterventionQuote, 'expiresAt'>, now: Date): boolean {
  if (!quote.expiresAt) return false;

  const ends = new Date(quote.expiresAt).getTime();

  return !Number.isNaN(ends) && ends < now.getTime();
}

const newestFirst = (a: TrackingInterventionQuote, b: TrackingInterventionQuote) => b.id - a.id;

/**
 * What the customer can do with the quotes of the mission. A quote that was sent can be accepted, refused, asked about, or sent
 * back for a change; one sent back for a change cannot be accepted until the technician has sent it again; one that lapsed cannot
 * be accepted either, but can still be asked about or sent back (which is how a new one is obtained).
 */
export function customerQuote(
  job: { status?: string | null; quotes?: readonly TrackingInterventionQuote[] | null },
  now: Date = new Date(),
  locale: Locale = DEFAULT_LOCALE,
): CustomerQuote {
  const words = quoteWords(locale);
  const quotes = [...(job.quotes ?? [])].sort(newestFirst);
  const accepted = quotes.find((quote) => quote.status === 'ACCEPTED');

  if (accepted) return { stage: 'accepted', quote: accepted, ...NOTHING, words: words.accepted };

  const status = canonicalStatus(job.status);
  const out = quotes.find((quote) => quote.status === 'SENT' || quote.status === 'MODIFICATION_REQUESTED');

  if (out) {
    if (status && CLOSED_TO_QUOTES.includes(status)) return { stage: 'closed', quote: out, ...NOTHING, words: words.closedJob };

    if (out.status === 'MODIFICATION_REQUESTED') {
      return { stage: 'being-changed', quote: out, canAccept: false, canRefuse: true, canAsk: true, canRequestChange: true, words: words.beingChanged };
    }

    if (isLapsed(out, now)) {
      const moment = momentText(out.expiresAt, locale);

      return {
        stage: 'expired',
        quote: out,
        canAccept: false,
        canRefuse: true,
        canAsk: true,
        canRequestChange: true,
        words: `${moment ? message(locale, 'customer.quote.expiredOn', { moment }) : words.expired} ${message(locale, 'customer.quote.expiredHint')}`,
      };
    }

    return { stage: 'to-answer', quote: out, canAccept: true, canRefuse: true, canAsk: true, canRequestChange: true, words: words.toAnswer };
  }

  const last = quotes[0] ?? null;

  if (!last) return { stage: 'none', quote: null, ...NOTHING, words: '' };
  if (last.status === 'REJECTED') return { stage: 'refused', quote: last, ...NOTHING, words: words.refused };
  if (last.status === 'EXPIRED') return { stage: 'expired', quote: last, ...NOTHING, words: words.expired };

  return { stage: 'closed', quote: last, ...NOTHING, words: words.cancelled };
}

/** True when two reads are of the same version of the same quote: the id and the revision decide (an edit of the quote makes a new revision). */
export function isSameQuote(
  read: Pick<TrackingInterventionQuote, 'id' | 'revision'> | null | undefined,
  live: Pick<TrackingInterventionQuote, 'id' | 'revision'> | null | undefined,
): boolean {
  return Boolean(read && live) && read!.id === live!.id && read!.revision === live!.revision;
}

/**
 * The state of the quote card in one string: it changes when the stage, the quote or its revision does, and only then. A message written
 * about an earlier state (a question sent, an answer refused) no longer holds once it changed.
 */
export function quoteSignature(state: Pick<CustomerQuote, 'stage' | 'quote'>): string {
  return state.quote ? `${state.stage}:${state.quote.id}:${state.quote.revision}` : state.stage;
}

/**
 * "Valable jusqu’au 31 octobre 2026 à 14 h 05", or "Expiré depuis le 3 octobre 2026 à 09 h 30"; null when the quote has no date. The
 * server ends a quote at an exact moment (so many days after it was sent), not at the end of a day: the hour is told too.
 */
export function validityWords(quote: Pick<TrackingInterventionQuote, 'expiresAt'>, now: Date = new Date(), locale: Locale = DEFAULT_LOCALE): string | null {
  const moment = momentText(quote.expiresAt, locale);

  if (!moment) return null;

  return isLapsed(quote, now) ? message(locale, 'customer.quote.expiredSince', { moment }) : message(locale, 'customer.quote.validUntil', { moment });
}

export type NoteRead = { ok: true; note: string | undefined } | { ok: false; problem: string };

/** The words the customer wrote with an answer: optional for an acceptance or a refusal, required for a question or a change. */
export function readQuoteNote(text: unknown, required: boolean, locale: Locale = DEFAULT_LOCALE): NoteRead {
  const note = typeof text === 'string' ? text.trim() : '';

  if (note === '') return required ? { ok: false, problem: message(locale, 'customer.quote.noteRequired') } : { ok: true, note: undefined };
  if ([...note].length > QUOTE_NOTE_MAX) return { ok: false, problem: message(locale, 'customer.quote.noteLong', { max: charactersText(QUOTE_NOTE_MAX, locale) }) };

  return { ok: true, note };
}

/** What the answer to a quote sends: the words, and the revision that was read (the server refuses the answer if the quote was edited since). */
export interface GuestQuoteBody {
  note?: string;
  revision?: number;
}

export function quoteAnswerBody(quote: Pick<TrackingInterventionQuote, 'revision'>, note?: string): GuestQuoteBody {
  const revision = Number(quote.revision);

  return {
    ...(note ? { note } : {}),
    ...(Number.isInteger(revision) && revision >= 1 ? { revision } : {}),
  };
}

/**
 * A refusal that says the state of the mission moved under the page: the quote was edited, answered or cancelled (400, 409), a payment
 * is already waiting (409), the link or the quote is gone (404). The page reads the mission again, and shows the server's sentence.
 */
export function stateHasMoved(status: number | null | undefined): boolean {
  return status === 400 || status === 404 || status === 409;
}

// ----------------------------------------------------------
// Paying
// ----------------------------------------------------------

/** The ways of paying a page can offer. */
export type PaymentChoice = 'CASH' | 'BANK_TRANSFER' | 'ONLINE_CARD';

/** GET /guest/interventions/:id/payment-options: how the holder of the link may pay (payment-options.ts on the server). */
export interface PaymentOptions {
  interventionId: number;
  currency: string;
  /** What is paid: the invoice, or the accepted quote while there is none. */
  document: 'INVOICE' | 'QUOTE' | null;
  total: number | null;
  received: number;
  /** What a request would ask for now. */
  amount: number | null;
  canPay: boolean;
  reason: string | null;
  methods: Array<{ method: PaymentChoice; available: boolean; reason: string | null }>;
  /** Where a transfer goes. */
  bank: { holder: string | null; rib: string; reference: string } | null;
  /** The payment that waits to be decided. */
  open: TrackingInterventionPayment | null;
}

/** What a request to pay sends. `reference` is the reference of the transfer once it was made; `clientNote` is free words. */
export interface GuestPaymentBody {
  method: PaymentChoice | 'ONLINE';
  reference?: string;
  clientNote?: string;
}

export interface GuestPaymentAnswer {
  payment: TrackingInterventionPayment;
  instructions: string;
  /** The same request was made before: the payment that waits is returned, nothing new is written. */
  replayed?: boolean;
}

/** The most a reference of a transfer can hold (the server's limit). */
export const PAYMENT_REFERENCE_MAX = 100;

/** The RIB in the groups a bank writes it in (bank 2, branch 3, account 13, key 2); anything else is returned as it is. */
export function formatRib(rib: string): string {
  const digits = rib.replace(/\s/g, '');

  return /^\d{20}$/.test(digits) ? `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 18)} ${digits.slice(18)}` : rib;
}

/** The account of a transfer as the page writes it (the RIB in its groups), or null when the options carry none. */
export interface TransferDetails {
  holder: string | null;
  ribText: string;
  reference: string;
}

export function transferDetails(options: Pick<PaymentOptions, 'bank'> | null | undefined): TransferDetails | null {
  const bank = options?.bank;

  return bank ? { holder: bank.holder, ribText: formatRib(bank.rib), reference: bank.reference } : null;
}

export type PaymentStage = 'none' | 'paid' | 'choose' | 'waiting' | 'blocked';

/** The two spellings of a card payment on a payment row (the choice on the page is `ONLINE_CARD`, the row says `ONLINE`). */
const ONLINE_WAYS: readonly string[] = ['ONLINE', 'ONLINE_CARD'];

/**
 * Where a card payment is (P2-10), from the payment that waits:
 *  - `ready`: the provider has it, the customer pays on the provider's page (`payUrl`) or has just done so;
 *  - `unprepared`: the request was recorded and the provider did not take it (it was down): asking again starts it;
 *  - `lapsed`: the time to pay is over and the server has not closed the request yet;
 *  - `review`: money came and the team has to look at it before it counts (late, or another amount). The customer has nothing to do.
 */
export type CardPhase = 'ready' | 'unprepared' | 'lapsed' | 'review';

export interface CardPayment {
  phase: CardPhase;
  /** The provider's page where the customer pays; only a `ready` payment has one. */
  payUrl: string | null;
  /** "14 h 35": when the time to pay ends, if the server said. */
  expiresText: string | null;
  /** The page asks the server again while it waits: the provider may settle the payment at any moment. */
  watch: boolean;
}

/** The way the customer picked, if it can still be paid in: a way that went away since (the options were read again) is not picked any more. */
export function pickedChoice(choices: readonly Pick<PaymentChoiceView, 'method' | 'available'>[], picked: PaymentChoice | null): PaymentChoice | null {
  return choices.some((item) => item.method === picked && item.available) ? picked : null;
}

export interface PaymentChoiceView {
  method: PaymentChoice;
  title: string;
  detail: string;
  available: boolean;
  reason: string | null;
}

export interface PaymentPanel {
  stage: PaymentStage;
  /** What is asked: the amount of the request, or of the payment that waits. */
  amountText: string | null;
  /**
   * The same amount written the same way in every language: what the page compares to know that the amount changed. `amountText` is
   * written in the language of the page, and a visitor who changes language has not changed the amount.
   */
  amountKey: string | null;
  words: string;
  choices: PaymentChoiceView[];
  open: TrackingInterventionPayment | null;
  bank: TransferDetails | null;
  /** A transfer waits: the reference it was made with can be sent, or corrected. */
  canSendReference: boolean;
  /** The payment that waits is a card payment (P2-10); null for the other ways and when none waits. */
  card: CardPayment | null;
}

export interface PaymentWords {
  unavailable: string;
  cardUnprepared: string;
  cardLapsed: string;
  cardReview: string;
  cardGoToProvider: string;
  cardTryAgain: string;
  cardChecking: string;
}

/** The sentences of the payment block that do not depend on an amount, in a language. */
export function paymentWords(locale: Locale = DEFAULT_LOCALE): PaymentWords {
  return {
    unavailable: message(locale, 'customer.payment.unavailable'),
    cardUnprepared: message(locale, 'customer.payment.cardUnprepared'),
    cardLapsed: message(locale, 'customer.payment.cardLapsed'),
    cardReview: message(locale, 'customer.payment.cardReview'),
    cardGoToProvider: message(locale, 'customer.payment.cardGoToProvider'),
    cardTryAgain: message(locale, 'customer.payment.cardTryAgain'),
    cardChecking: message(locale, 'customer.payment.cardChecking'),
  };
}

/** The same sentences in French. */
export const PAYMENT_WORDS: PaymentWords = paymentWords('fr');

/** The provider's page is a link the customer is sent to: only an https address is one (anything else is not shown as a button). */
export function isPayUrl(url: unknown): url is string {
  // Not `new URL(...)`: the phone's runtime does not implement all of it. An address with a host, no space, no backslash (a browser reads it as a slash), no script. The server holds the provider's page to the same rule (isPayPage).
  return typeof url === 'string' && url.length <= 2000 && /^https:\/\/[^\s/?#@\\]+(?:[/?#][^\s\\]*)?$/i.test(url);
}

/** The card payment that waits, as the page shows it; null when what waits is not a card payment. */
export function cardPaymentOf(open: TrackingInterventionPayment | null | undefined, now: Date = new Date(), locale: Locale = DEFAULT_LOCALE): CardPayment | null {
  if (!open || !ONLINE_WAYS.includes(open.method)) return null;

  if (open.status === 'AWAITING_CONFIRMATION') return { phase: 'review', payUrl: null, expiresText: null, watch: false };
  if (open.status !== 'PENDING') return null;

  if (!isPayUrl(open.payUrl)) return { phase: 'unprepared', payUrl: null, expiresText: null, watch: false };

  const ends = open.expiresAt ? new Date(open.expiresAt) : null;
  const expiresText = ends && !Number.isNaN(ends.getTime()) ? hourText(open.expiresAt, locale) : null;

  if (ends && !Number.isNaN(ends.getTime()) && ends.getTime() <= now.getTime()) return { phase: 'lapsed', payUrl: null, expiresText, watch: true };

  return { phase: 'ready', payUrl: open.payUrl, expiresText, watch: true };
}

/**
 * The customer can ask again for a card payment that cannot be paid as it is: the provider never took the request, or its time is over
 * (the server then looks at the provider one last time, closes the old request and starts a new one; a customer whose clock is
 * ahead of the server's, who sees "over" a little early, is handed the same page back).
 */
export function cardCanTryAgain(card: CardPayment | null | undefined): boolean {
  return card?.phase === 'unprepared' || card?.phase === 'lapsed';
}

function waitingWords(open: TrackingInterventionPayment, amountText: string, card: CardPayment | null, locale: Locale): string {
  const words = paymentWords(locale);
  const amount = isolateFor(locale, amountText);

  if (card) {
    if (card.phase === 'review') return words.cardReview;
    if (card.phase === 'unprepared') return words.cardUnprepared;
    if (card.phase === 'lapsed') return words.cardLapsed;

    return card.expiresText
      ? message(locale, 'customer.payment.cardWaitingUntil', { amount, time: isolateFor(locale, card.expiresText) })
      : message(locale, 'customer.payment.cardWaiting', { amount });
  }

  if (open.method === 'BANK_TRANSFER') {
    return open.reference ? message(locale, 'customer.payment.transferWaiting', { amount }) : message(locale, 'customer.payment.transferAsked', { amount });
  }

  if (open.method === 'CASH') return message(locale, 'customer.payment.cashWaiting', { amount });

  return message(locale, 'customer.payment.otherWaiting', { amount });
}

/**
 * What the payment block of the page shows, from the options the server gave. `null` while there are none (they have not been read,
 * or the read failed): the block is not shown rather than shown wrong.
 */
export function paymentPanel(options: PaymentOptions | null | undefined, now: Date = new Date(), locale: Locale = DEFAULT_LOCALE): PaymentPanel | null {
  if (!options) return null;

  const words = paymentWords(locale);
  const open = options.open ?? null;
  const amountText =
    options.amount !== null && options.amount !== undefined ? moneyText(options.amount, options.currency, locale) : open ? moneyText(open.amount, open.currency, locale) : null;
  const amountKey =
    options.amount !== null && options.amount !== undefined ? moneyText(options.amount, options.currency, DEFAULT_LOCALE) : open ? moneyText(open.amount, open.currency, DEFAULT_LOCALE) : null;
  const bank = transferDetails(options);
  const choices = options.methods.map<PaymentChoiceView>((choice) => ({
    method: choice.method,
    // A way of paying the catalogue does not know shows as the server named it, and with no detail (never the key of a message).
    title: messageText(locale, `customer.payment.choices.${choice.method}.title`) === null ? choice.method : message(locale, `customer.payment.choices.${choice.method}.title`),
    detail: messageText(locale, `customer.payment.choices.${choice.method}.detail`) === null ? '' : message(locale, `customer.payment.choices.${choice.method}.detail`),
    available: choice.available,
    // The server's own sentence: it comes in the language of the request.
    reason: choice.reason,
  }));

  // A payment that waits comes first: cash an artisan declared leaves nothing to pay (the job reads as paid), and is still to be confirmed.
  if (open) {
    const waitingAmount = moneyText(open.amount, open.currency, locale);
    const card = cardPaymentOf(open, now, locale);

    return {
      stage: 'waiting',
      // What is asked is what the payment that waits is for (a transfer to make is for that amount, whatever the invoice asks now).
      amountText: waitingAmount,
      amountKey: moneyText(open.amount, open.currency, DEFAULT_LOCALE),
      words: waitingWords(open, waitingAmount, card, locale),
      choices,
      open,
      bank: open.method === 'BANK_TRANSFER' ? bank : null,
      canSendReference: open.method === 'BANK_TRANSFER',
      card,
    };
  }

  if (options.document === null) return { stage: 'none', amountText: null, amountKey: null, words: '', choices, open: null, bank: null, canSendReference: false, card: null };

  const total = amountOf(options.total);

  if (total > 0 && amountOf(options.received) >= total) {
    const receivedText = moneyText(options.received, options.currency, locale);

    return {
      stage: 'paid',
      amountText: receivedText,
      amountKey: moneyText(options.received, options.currency, DEFAULT_LOCALE),
      words: message(locale, 'customer.payment.paid', { amount: isolateFor(locale, receivedText) }),
      choices: [],
      open: null,
      bank: null,
      canSendReference: false,
      card: null,
    };
  }

  if (!options.canPay) return { stage: 'blocked', amountText, amountKey, words: options.reason || words.unavailable, choices, open: null, bank: null, canSendReference: false, card: null };

  return {
    stage: 'choose',
    amountText,
    amountKey,
    words: amountText ? message(locale, 'customer.payment.remaining', { amount: isolateFor(locale, amountText) }) : message(locale, 'customer.payment.choose'),
    choices,
    open: null,
    bank,
    canSendReference: false,
    card: null,
  };
}

/** The state of the payment block in one string: it changes when the stage, the payment that waits (its status, its reference) or the amount does, and only then. */
export function paymentSignature(panel: Pick<PaymentPanel, 'stage' | 'open' | 'amountKey'> & { card?: CardPayment | null } | null | undefined): string {
  if (!panel) return 'none';

  const open = panel.open;

  return [panel.stage, open ? open.id : '', open ? open.status : '', open ? (open.reference ?? '') : '', panel.amountKey ?? '', panel.card?.phase ?? ''].join(':');
}

/** The page reads the payment options once there is a quote that was accepted, or an invoice, and the request is not cancelled. */
export function wantsPaymentOptions(job: { status?: string | null; quotes?: readonly Pick<TrackingInterventionQuote, 'status'>[] | null; invoice?: unknown }): boolean {
  const status = canonicalStatus(job.status);

  if (status === 'CANCELLED') return false;

  return Boolean(job.invoice) || (job.quotes ?? []).some((quote) => quote.status === 'ACCEPTED');
}

// ----------------------------------------------------------
// Coming back from the provider's page (P2-10)
// ----------------------------------------------------------

/** The page of the website the provider sends the customer back to, whatever happened (the server's `RETURN_PATH`). */
export const PAYMENT_RETURN_PATH = '/paiement/retour';

/** Where the page keeps which job the customer was paying while they are at the provider (in the tab: it dies with it). */
export const PAYMENT_RETURN_KEY = 'smart-depannage.card-payment';

/** How long what the page kept is good for: longer than the time to pay, short enough that an old tab does not pick up an old job. */
export const PAYMENT_RETURN_MAX_AGE_MS = 3 * 60 * 60 * 1000;

export interface PaymentReturnMemory {
  id: number;
  token: string;
}

/** What the page writes before it sends the customer to the provider. */
export function rememberPaymentReturn(memory: PaymentReturnMemory, now: Date = new Date()): string {
  return JSON.stringify({ id: memory.id, token: memory.token, at: now.getTime() });
}

/**
 * What the page kept, read again when the customer is back. Anything that is not exactly that (nothing, another tab's text, an old
 * entry, an id that is not a whole number, an empty or huge token) is nothing: the page then tells the customer to follow their
 * request with the link they were sent.
 */
export function recallPaymentReturn(text: unknown, now: Date = new Date()): PaymentReturnMemory | null {
  if (typeof text !== 'string' || text === '' || text.length > 2000) return null;

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (parsed === null || typeof parsed !== 'object') return null;

  const { id, token, at } = parsed as Record<string, unknown>;

  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) return null;
  if (typeof token !== 'string' || token.length === 0 || token.length > 500) return null;
  if (typeof at !== 'number' || !Number.isFinite(at) || now.getTime() - at > PAYMENT_RETURN_MAX_AGE_MS || at - now.getTime() > 60_000) return null;

  return { id, token };
}

export type PaymentReturnVerdict = 'paid' | 'waiting' | 'review' | 'failed' | 'unknown';

export interface PaymentReturn {
  verdict: PaymentReturnVerdict;
  words: string;
  /** The page asks again in a few seconds. */
  again: boolean;
}

export interface ReturnWords {
  paid: string;
  waiting: string;
  failed: string;
  unknown: string;
  lost: string;
  tooLong: string;
}

/** The sentences of the page the card provider sends the customer back to, in a language. */
export function returnWords(locale: Locale = DEFAULT_LOCALE): ReturnWords {
  return {
    paid: message(locale, 'customer.returns.paid'),
    waiting: message(locale, 'customer.returns.waiting'),
    failed: message(locale, 'customer.returns.failed'),
    unknown: message(locale, 'customer.returns.unknown'),
    lost: message(locale, 'customer.returns.lost'),
    tooLong: message(locale, 'customer.returns.tooLong'),
  };
}

/** The same sentences in French. */
export const RETURN_WORDS: ReturnWords = returnWords('fr');

/** What the return page says, from the options the server gave once it had asked the provider. `null`: the options could not be read. */
export function paymentReturn(panel: PaymentPanel | null | undefined, locale: Locale = DEFAULT_LOCALE): PaymentReturn {
  const words = returnWords(locale);

  if (!panel) return { verdict: 'unknown', words: words.unknown, again: false };

  if (panel.stage === 'paid') return { verdict: 'paid', words: words.paid, again: false };

  if (panel.stage === 'waiting' && panel.card) {
    if (panel.card.phase === 'review') return { verdict: 'review', words: paymentWords(locale).cardReview, again: false };
    if (panel.card.phase === 'ready' || panel.card.phase === 'lapsed') return { verdict: 'waiting', words: words.waiting, again: true };
  }

  // The payment was refused, lapsed or cancelled (nothing waits any more and nothing is paid), or what waits is not a card payment.
  return { verdict: 'failed', words: words.failed, again: false };
}

/**
 * How often the tracking page asks the server to ask the provider while a card payment waits. The webhook and the server's own timer
 * settle a payment by themselves; this is a nudge for the customer who has just paid, so it is slower than the page's own pace. The page
 * reads the options every 20 seconds and asks when 30 have passed, that is about every 40 seconds (some 90 an hour for an open tab); the
 * server lets one address ask 360 an hour, so a second tab, the return page or a neighbour on the same mobile address still fit.
 */
export const CARD_CHECK_EVERY_MS = 30_000;

/** Whether the page should ask the provider's side now rather than only read the options: a card payment waits and the last ask is old enough. */
export function cardCheckDue(watching: boolean, lastCheckAt: number | null, now: number): boolean {
  if (!watching) return false;
  if (lastCheckAt === null) return true;

  // A clock that went back asks again rather than never.
  return now < lastCheckAt || now - lastCheckAt >= CARD_CHECK_EVERY_MS;
}

/** The most times the return page asks, and how long it waits between two (the provider usually settles within seconds). */
export const RETURN_CHECKS_MAX = 12;
export const RETURN_CHECK_EVERY_MS = 4000;

export type ReferenceRead = { ok: true; reference: string } | { ok: false; problem: string };

/** The reference of a transfer, as the customer typed it. */
export function readTransferReference(text: unknown, locale: Locale = DEFAULT_LOCALE): ReferenceRead {
  const reference = typeof text === 'string' ? text.trim() : '';

  if (reference === '') return { ok: false, problem: message(locale, 'customer.payment.referenceRequired') };
  if ([...reference].length > PAYMENT_REFERENCE_MAX) return { ok: false, problem: message(locale, 'customer.payment.referenceLong', { max: charactersText(PAYMENT_REFERENCE_MAX, locale) }) };

  return { ok: true, reference };
}

/** The words of a way of paying (`customer.payment.methods.*`), by the spelling of the payment row. */
const METHOD_KEYS: Record<string, 'cash' | 'transfer' | 'card'> = { CASH: 'cash', BANK_TRANSFER: 'transfer', ONLINE: 'card', ONLINE_CARD: 'card' };

type PaymentStatusKey = 'awaitingConfirmation' | 'awaitingPayment' | 'received' | 'partlyRefunded' | 'refunded' | 'failed';

const PAYMENT_STATUS_WORDS: Record<string, { key: PaymentStatusKey; tone: StatusTone }> = {
  AWAITING_CONFIRMATION: { key: 'awaitingConfirmation', tone: 'warning' },
  PAID: { key: 'received', tone: 'success' },
  PARTIALLY_REFUNDED: { key: 'partlyRefunded', tone: 'info' },
  REFUNDED: { key: 'refunded', tone: 'info' },
  FAILED: { key: 'failed', tone: 'danger' },
};

export interface PaymentLine {
  id: number;
  methodText: string;
  amountText: string;
  statusWords: string;
  tone: StatusTone;
  dateText: string | null;
}

/** How a payment is told: by its status, except that a request for cash or a transfer that is still "pending" waits for the team like the others. */
function paymentStatusOf(payment: Pick<TrackingInterventionPayment, 'status' | 'method'> & { payUrl?: string | null }): { key: PaymentStatusKey; tone: StatusTone } | undefined {
  if (payment.status === 'PENDING' && !ONLINE_WAYS.includes(payment.method)) return PAYMENT_STATUS_WORDS.AWAITING_CONFIRMATION;
  // A card payment the provider has taken waits for the customer's payment; one it never took is not a payment.
  if (payment.status === 'PENDING' && isPayUrl(payment.payUrl)) return { key: 'awaitingPayment', tone: 'warning' };

  return PAYMENT_STATUS_WORDS[payment.status];
}

/** The payments the customer is told about: the ones that were asked for and not cancelled. A card request nobody could pay is not one. */
export function paymentLines(payments: readonly TrackingInterventionPayment[] | null | undefined, locale: Locale = DEFAULT_LOCALE): PaymentLine[] {
  return [...(payments ?? [])]
    .filter((payment) => paymentStatusOf(payment) !== undefined)
    .sort((a, b) => a.id - b.id)
    .map((payment) => {
      const status = paymentStatusOf(payment)!;
      const method = METHOD_KEYS[payment.method];

      return {
        id: payment.id,
        methodText: method ? message(locale, `customer.payment.methods.${method}`) : payment.method,
        amountText: moneyText(payment.amount, payment.currency, locale),
        statusWords: message(locale, `customer.payment.statuses.${status.key}`),
        tone: status.tone,
        dateText: dayText(payment.confirmedAt ?? payment.requestedAt ?? payment.createdAt, locale),
      };
    });
}

// ----------------------------------------------------------
// The invoice
// ----------------------------------------------------------

export type InvoiceDownload = { kind: 'link'; href: string } | { kind: 'print' };

/** A complete https address with a host name (no sign-in in front of it, no address of a machine): the only kind of PDF address the page links to. */
const HTTPS_LINK = /^https:\/\/(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d{1,5})?(?:[/?#]\S*)?$/i;

/** The address of a PDF the page may link to: a complete https address. Anything else (a path of the server, another scheme) is not offered as a link. */
export function pdfLink(pdfUrl: string | null | undefined): string | null {
  const link = typeof pdfUrl === 'string' ? pdfUrl.trim() : '';

  return HTTPS_LINK.test(link) ? link : null;
}

/** One credit note taken off the invoice, as the customer reads it. */
export interface CreditNoteLine {
  id: number;
  number: string;
  /** "Émis le 25 octobre 2026". */
  issuedText: string | null;
  reason: string | null;
  /** What it takes off, with its sign: "- 19,000 DT". */
  amountText: string;
  /** The PDF of the credit note when the page can link to it. */
  href: string | null;
}

/** The totals of an invoice: the lines of a quote, then the stamp duty, the credit notes and what is left to pay. */
export interface InvoiceTotals extends DocumentTotals {
  /** The stamp duty ("timbre fiscal"), when the invoice has one. */
  stampText: string | null;
  /** The total with the stamp duty: what the invoice asks before the credit notes. Same as `totalText` when there is no stamp duty. */
  toPayText: string;
  /** "Total à payer" while the invoice asks for payment; "Total facturé" once it is paid or cancelled (it asks for nothing then). */
  toPayLabel: string;
  creditNotes: CreditNoteLine[];
  /** What is left to pay once the credit notes are taken off; null when there is none. For a paid or cancelled invoice it is the net of the invoice. */
  netToPayText: string | null;
  /** "Net à payer", or "Net de la facture" once the invoice is paid or cancelled. */
  netLabel: string;
}

export interface InvoiceDocument {
  number: string;
  title: string;
  statusWords: string;
  tone: StatusTone;
  issuedText: string | null;
  company: { name: string | null; taxId: string | null; registre: string | null; address: string | null; phone: string | null; email: string | null; website: string | null; rib: string | null };
  client: { name: string | null; address: string | null; phone: string | null; email: string | null; taxId: string | null };
  /** What the invoice is for. */
  service: string | null;
  address: string | null;
  lines: DocumentLine[];
  totals: InvoiceTotals;
  /** The legal lines of the company, printed at the foot of the invoice. */
  legalMentions: string | null;
  paymentTerms: string | null;
  notes: string | null;
  /** The PDF when the invoice has one the page can link to; else the page prints the invoice itself (the browser saves it as a PDF). */
  download: InvoiceDownload;
  /** The name a saved copy should have: "facture-f-2026-0001". */
  fileName: string;
}

/** The addresses of the PDF files of a request, built from the address of the server and the private link of the request. */
export interface GuestPdfLinks {
  /** The drawn PDF of the invoice. */
  invoice: string | null;
  creditNote(creditNoteId: number): string | null;
}

const NO_PDF_LINKS: GuestPdfLinks = { invoice: null, creditNote: () => null };

/**
 * The PDF addresses of a request (P2-07): `https://server/api/guest/interventions/12/invoice/pdf?token=…`, and the same for each
 * credit note. Only a complete https address is a link (a development server on http gives none, and the page prints instead).
 */
export function guestPdfLinks(apiBase: string | null | undefined, id: number | string | null | undefined, token: string | null | undefined): GuestPdfLinks {
  const base = typeof apiBase === 'string' ? apiBase.trim().replace(/\/+$/, '') : '';
  const job = String(id ?? '').trim();
  const secret = typeof token === 'string' ? token.trim() : '';

  if (!/^[1-9]\d{0,9}$/.test(job) || secret === '' || !pdfLink(base)) return NO_PDF_LINKS;

  const query = `?token=${encodeURIComponent(secret)}`;
  const root = `${base}/guest/interventions/${job}`;

  return {
    invoice: pdfLink(`${root}/invoice/pdf${query}`),
    creditNote: (creditNoteId) => (Number.isInteger(creditNoteId) && creditNoteId > 0 ? pdfLink(`${root}/credit-notes/${creditNoteId}/pdf${query}`) : null),
  };
}

const text = (value: string | null | undefined): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);

/** The name of a file for an invoice number: lower case, letters, digits and dashes. */
export function invoiceFileName(number: string): string {
  const slug = number
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug ? `facture-${slug}` : 'facture';
}

/** What the page knows about where the PDF files are (the address of the server and the link of the request), and the language it speaks. */
export interface InvoiceDocumentOptions {
  pdf?: GuestPdfLinks | null;
  /** The language of the words of the invoice page (French when left out). */
  locale?: Locale;
}

/** The invoice as the page shows, prints and offers it; null when there is none (a draft is not the customer's, the server does not send it). */
export function invoiceDocument(invoice: TrackingInterventionInvoice | null | undefined, options: InvoiceDocumentOptions = {}): InvoiceDocument | null {
  if (!invoice || invoice.status === 'DRAFT') return null;

  const locale = options.locale ?? DEFAULT_LOCALE;
  const pdf = options.pdf ?? NO_PDF_LINKS;
  const paid = invoice.status === 'PAID' || invoice.paymentStatus === 'PAID';
  const paidDay = dayText(invoice.paidAt, locale);
  // The PDF the server draws is the invoice as it stands; an uploaded file (an older invoice may have one) is the fallback.
  const link = pdf.invoice ?? pdfLink(invoice.pdfUrl);
  const { statusWords, tone } =
    invoice.status === 'CANCELLED'
      ? { statusWords: message(locale, 'customer.invoice.cancelled'), tone: 'danger' as StatusTone }
      : paid
        ? { statusWords: paidDay ? message(locale, 'customer.invoice.paidOn', { day: paidDay }) : message(locale, 'customer.invoice.paid'), tone: 'success' as StatusTone }
        : { statusWords: message(locale, 'customer.invoice.toPay'), tone: 'warning' as StatusTone };
  const issued = dayText(invoice.issuedAt ?? invoice.sentAt ?? invoice.createdAt, locale);
  const currency = invoice.currency;
  const stamp = amountOf(invoice.stampDuty);
  const credited = amountOf(invoice.creditedAmount);
  const toPay = amountOf(invoice.amountTTC) + stamp;
  const notes = [...(invoice.creditNotes ?? [])].sort((a, b) => a.id - b.id);
  const creditNotes: CreditNoteLine[] = notes.map((note) => {
    const day = dayText(note.issuedAt ?? note.createdAt, locale);

    return {
      id: note.id,
      number: note.creditNoteNumber,
      issuedText: day ? message(locale, 'customer.invoice.creditNoteIssuedOn', { day }) : null,
      reason: text(note.reason),
      // A real minus sign (U+2212): a screen reader says "moins" for it, and drops a hyphen.
      amountText: `\u2212 ${moneyText(toDinars(amountOf(note.amountTTC) + amountOf(note.stampDuty)), currency, locale)}`,
      href: pdf.creditNote(note.id),
    };
  });

  return {
    number: invoice.invoiceNumber,
    title: message(locale, 'customer.invoice.title', { number: isolateFor(locale, invoice.invoiceNumber) }),
    statusWords,
    tone,
    issuedText: issued ? message(locale, 'customer.invoice.issuedOn', { day: issued }) : null,
    company: {
      name: text(invoice.companyName),
      taxId: text(invoice.companyTaxId),
      registre: text(invoice.companyRegistre),
      address: text(invoice.companyAddress),
      phone: text(invoice.companyPhone),
      email: text(invoice.companyEmail),
      website: text(invoice.companyWebsite),
      rib: text(invoice.companyRib),
    },
    client: { name: text(invoice.clientName), address: text(invoice.clientAddress), phone: text(invoice.clientPhone), email: text(invoice.clientEmail), taxId: text(invoice.clientTaxId) },
    service: text(invoice.subServiceName) ?? text(invoice.interventionDescription),
    address: text(invoice.interventionAddress),
    lines: documentLines(invoice.items, currency, locale),
    totals: {
      ...documentTotals(invoice, locale),
      stampText: stamp > 0 ? moneyText(toDinars(stamp), currency, locale) : null,
      toPayText: moneyText(toDinars(toPay), currency, locale),
      toPayLabel: tone === 'warning' ? message(locale, 'customer.invoice.totalToPay') : message(locale, 'customer.invoice.totalBilled'),
      creditNotes,
      netToPayText: credited > 0 || creditNotes.length > 0 ? moneyText(toDinars(Math.max(toPay - credited, 0)), currency, locale) : null,
      netLabel: tone === 'warning' ? message(locale, 'customer.invoice.netToPay') : message(locale, 'customer.invoice.netOfInvoice'),
    },
    legalMentions: text(invoice.legalMentions),
    paymentTerms: text(invoice.paymentTerms),
    notes: text(invoice.notes),
    download: link ? { kind: 'link', href: link } : { kind: 'print' },
    fileName: invoiceFileName(invoice.invoiceNumber),
  };
}
