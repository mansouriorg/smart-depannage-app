import { canonicalStatus, type CanonicalStatus } from './generated/intervention-status';
import type { TrackingInterventionInvoice, TrackingInterventionPayment, TrackingInterventionQuote } from './generated/views';
import { formatMillimes, toDinars, toMillimes } from './money';
import type { StatusTone } from './status';

/**
 * What a customer does from the tracking link alone (P2-06): read the quote and answer it, choose how to pay, read and keep the
 * invoice. The server's side is `smart-depannage-serveur` (src/modules/guest, src/modules/quotes/quote-decisions.ts and
 * src/modules/payments/payment-options.ts there); the rules below say the same as it does, so that a button the page shows is one
 * the server accepts. The server has the last word and its sentence is what the page shows when it refuses.
 *
 * Amounts reach the page as the figure of a DECIMAL column (a number, or its text: "119.000"); `amountOf` reads both, in whole
 * millimes, and nothing here adds two dinar amounts as floating-point numbers.
 */

// ----------------------------------------------------------
// Amounts and dates
// ----------------------------------------------------------

/** An amount as the server sent it (a number, or the text of one) in whole millimes; 0 when it is neither. */
export function amountOf(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));

  return Number.isFinite(number) ? toMillimes(number) : 0;
}

/** The unit a screen writes after an amount: "DT" for the dinar, else the code of the currency. */
export function currencyUnit(currency: string | null | undefined): string {
  return !currency || currency === 'TND' ? 'DT' : currency;
}

/** An amount as the money screens write it: "119,000 DT". */
export function moneyText(value: unknown, currency?: string | null): string {
  return formatMillimes(amountOf(value), currencyUnit(currency));
}

const DAY = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Tunis', day: 'numeric', month: 'long', year: 'numeric' });

const HOUR = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Tunis', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** The hour as people write it in Tunis: "14 h 05". Null when there is none (or it is not a date). */
export function hourText(iso: string | null | undefined): string | null {
  if (!iso) return null;

  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? null : HOUR.format(date).replace(':', ' h ');
}

/** A date and its hour as people write them in Tunis: "24 octobre 2026 à 14 h 05". Null when there is no date (or it is not one). */
export function momentText(iso: string | null | undefined): string | null {
  const day = dayText(iso);
  const hour = hourText(iso);

  return day && hour ? `${day} à ${hour}` : day;
}

/** A date as people write it in Tunis: "24 octobre 2026". Null when there is none (or it is not a date). */
export function dayText(iso: string | null | undefined): string | null {
  if (!iso) return null;

  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? null : DAY.format(date);
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

export function documentLines(items: readonly Line[] | null | undefined, currency?: string | null): DocumentLine[] {
  return (items ?? []).map((line) => ({
    label: line.label,
    description: line.description?.trim() ? line.description.trim() : null,
    quantityText: quantityText(line.quantity),
    unitText: moneyText(line.unitPrice, currency),
    totalText: moneyText(line.total, currency),
  }));
}

export interface DocumentTotals {
  subtotalText: string;
  /** "TVA 19 %" */
  taxLabel: string;
  taxText: string;
  totalText: string;
}

export function documentTotals(document: { amountHT: number; taxRate: number; taxAmount: number; amountTTC: number; currency?: string | null }): DocumentTotals {
  const rate = Number(document.taxRate);

  return {
    subtotalText: moneyText(document.amountHT, document.currency),
    taxLabel: `TVA ${Number.isFinite(rate) ? String(rate).replace('.', ',') : '0'} %`,
    taxText: moneyText(document.taxAmount, document.currency),
    totalText: moneyText(document.amountTTC, document.currency),
  };
}

// ----------------------------------------------------------
// The quote
// ----------------------------------------------------------

/** The most a note on a quote can hold (the server's limit). */
export const QUOTE_NOTE_MAX = 500;

/** The statuses of a mission in which its quotes are no longer answered (quote-decisions.ts there: JOB_STATUSES_CLOSED_TO_QUOTES). */
const CLOSED_TO_QUOTES: readonly CanonicalStatus[] = ['CANCELLED', 'DISPUTED', 'COMPLETED', 'PAYMENT_PENDING', 'PAID', 'INVOICE_SENT'];

export const QUOTE_WORDS = {
  closedJob: 'Cette mission n’accepte plus de réponse sur ses devis.',
  toAnswer: 'Un devis vous attend : acceptez-le, posez une question ou demandez une modification.',
  beingChanged: 'Vous avez demandé une modification : le technicien modifie le devis, vous pourrez l’accepter dès qu’il vous sera renvoyé.',
  accepted: 'Vous avez accepté ce devis.',
  refused: 'Ce devis a été refusé.',
  cancelled: 'Ce devis a été annulé.',
  expired: 'Ce devis a expiré. Pour en obtenir un nouveau, écrivez-nous dans « Un problème ? » plus bas sur cette page.',
};

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
export function customerQuote(job: { status?: string | null; quotes?: readonly TrackingInterventionQuote[] | null }, now: Date = new Date()): CustomerQuote {
  const quotes = [...(job.quotes ?? [])].sort(newestFirst);
  const accepted = quotes.find((quote) => quote.status === 'ACCEPTED');

  if (accepted) return { stage: 'accepted', quote: accepted, ...NOTHING, words: QUOTE_WORDS.accepted };

  const status = canonicalStatus(job.status);
  const out = quotes.find((quote) => quote.status === 'SENT' || quote.status === 'MODIFICATION_REQUESTED');

  if (out) {
    if (status && CLOSED_TO_QUOTES.includes(status)) return { stage: 'closed', quote: out, ...NOTHING, words: QUOTE_WORDS.closedJob };

    if (out.status === 'MODIFICATION_REQUESTED') {
      return { stage: 'being-changed', quote: out, canAccept: false, canRefuse: true, canAsk: true, canRequestChange: true, words: QUOTE_WORDS.beingChanged };
    }

    if (isLapsed(out, now)) {
      const moment = momentText(out.expiresAt);

      return {
        stage: 'expired',
        quote: out,
        canAccept: false,
        canRefuse: true,
        canAsk: true,
        canRequestChange: true,
        words: `${moment ? `Ce devis a expiré le ${moment}.` : QUOTE_WORDS.expired} Vous ne pouvez plus l’accepter : demandez-en un nouveau ou posez une question.`,
      };
    }

    return { stage: 'to-answer', quote: out, canAccept: true, canRefuse: true, canAsk: true, canRequestChange: true, words: QUOTE_WORDS.toAnswer };
  }

  const last = quotes[0] ?? null;

  if (!last) return { stage: 'none', quote: null, ...NOTHING, words: '' };
  if (last.status === 'REJECTED') return { stage: 'refused', quote: last, ...NOTHING, words: QUOTE_WORDS.refused };
  if (last.status === 'EXPIRED') return { stage: 'expired', quote: last, ...NOTHING, words: QUOTE_WORDS.expired };

  return { stage: 'closed', quote: last, ...NOTHING, words: QUOTE_WORDS.cancelled };
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
export function validityWords(quote: Pick<TrackingInterventionQuote, 'expiresAt'>, now: Date = new Date()): string | null {
  const moment = momentText(quote.expiresAt);

  if (!moment) return null;

  return isLapsed(quote, now) ? `Expiré depuis le ${moment}` : `Valable jusqu’au ${moment}`;
}

export type NoteRead = { ok: true; note: string | undefined } | { ok: false; problem: string };

/** The words the customer wrote with an answer: optional for an acceptance or a refusal, required for a question or a change. */
export function readQuoteNote(text: unknown, required: boolean): NoteRead {
  const note = typeof text === 'string' ? text.trim() : '';

  if (note === '') return required ? { ok: false, problem: 'Écrivez votre question ou votre demande.' } : { ok: true, note: undefined };
  if ([...note].length > QUOTE_NOTE_MAX) return { ok: false, problem: `Votre message est trop long (${QUOTE_NOTE_MAX} caractères au plus).` };

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
  words: string;
  choices: PaymentChoiceView[];
  open: TrackingInterventionPayment | null;
  bank: TransferDetails | null;
  /** A transfer waits: the reference it was made with can be sent, or corrected. */
  canSendReference: boolean;
}

const CHOICE_WORDS: Record<PaymentChoice, { title: string; detail: string }> = {
  CASH: { title: 'Espèces', detail: 'Vous remettez la somme au technicien. Notre équipe confirme la réception.' },
  BANK_TRANSFER: { title: 'Virement bancaire', detail: 'Vous virez la somme sur le compte de l’entreprise, puis vous nous envoyez la référence du virement.' },
  ONLINE_CARD: { title: 'Carte bancaire', detail: 'Paiement en ligne.' },
};

export const PAYMENT_WORDS = {
  unavailable: 'Le paiement n’est pas disponible pour le moment.',
};

function waitingWords(open: TrackingInterventionPayment, amountText: string): string {
  if (open.method === 'BANK_TRANSFER') {
    return open.reference
      ? `Virement de ${amountText} en attente de confirmation. Notre équipe le confirmera dès réception.`
      : `Virement de ${amountText} demandé. Une fois fait, envoyez-nous sa référence : notre équipe confirmera la réception.`;
  }

  if (open.method === 'CASH') {
    return `Paiement de ${amountText} en espèces en attente de confirmation par notre équipe. Si vous n’avez pas encore remis la somme, remettez-la au technicien.`;
  }

  return `Paiement de ${amountText} en attente de confirmation.`;
}

/**
 * What the payment block of the page shows, from the options the server gave. `null` while there are none (they have not been read,
 * or the read failed): the block is not shown rather than shown wrong.
 */
export function paymentPanel(options: PaymentOptions | null | undefined): PaymentPanel | null {
  if (!options) return null;

  const open = options.open ?? null;
  const amountText = options.amount !== null && options.amount !== undefined ? moneyText(options.amount, options.currency) : open ? moneyText(open.amount, open.currency) : null;
  const bank = transferDetails(options);
  const choices = options.methods.map<PaymentChoiceView>((choice) => ({
    method: choice.method,
    ...CHOICE_WORDS[choice.method],
    available: choice.available,
    reason: choice.reason,
  }));

  // A payment that waits comes first: cash an artisan declared leaves nothing to pay (the job reads as paid), and is still to be confirmed.
  if (open) {
    const waitingAmount = moneyText(open.amount, open.currency);

    return {
      stage: 'waiting',
      // What is asked is what the payment that waits is for (a transfer to make is for that amount, whatever the invoice asks now).
      amountText: waitingAmount,
      words: waitingWords(open, waitingAmount),
      choices,
      open,
      bank: open.method === 'BANK_TRANSFER' ? bank : null,
      canSendReference: open.method === 'BANK_TRANSFER',
    };
  }

  if (options.document === null) return { stage: 'none', amountText: null, words: '', choices, open: null, bank: null, canSendReference: false };

  const total = amountOf(options.total);

  if (total > 0 && amountOf(options.received) >= total) {
    return { stage: 'paid', amountText: moneyText(options.received, options.currency), words: `Le paiement de ${moneyText(options.received, options.currency)} est enregistré. Merci.`, choices: [], open: null, bank: null, canSendReference: false };
  }

  if (!options.canPay) return { stage: 'blocked', amountText, words: options.reason || PAYMENT_WORDS.unavailable, choices, open: null, bank: null, canSendReference: false };

  return {
    stage: 'choose',
    amountText,
    words: amountText ? `Il reste ${amountText} à payer. Choisissez comment vous payez.` : 'Choisissez comment vous payez.',
    choices,
    open: null,
    bank,
    canSendReference: false,
  };
}

/** The state of the payment block in one string: it changes when the stage, the payment that waits (its status, its reference) or the amount does, and only then. */
export function paymentSignature(panel: Pick<PaymentPanel, 'stage' | 'open' | 'amountText'> | null | undefined): string {
  if (!panel) return 'none';

  const open = panel.open;

  return [panel.stage, open ? open.id : '', open ? open.status : '', open ? (open.reference ?? '') : '', panel.amountText ?? ''].join(':');
}

/** The page reads the payment options once there is a quote that was accepted, or an invoice, and the request is not cancelled. */
export function wantsPaymentOptions(job: { status?: string | null; quotes?: readonly Pick<TrackingInterventionQuote, 'status'>[] | null; invoice?: unknown }): boolean {
  const status = canonicalStatus(job.status);

  if (status === 'CANCELLED') return false;

  return Boolean(job.invoice) || (job.quotes ?? []).some((quote) => quote.status === 'ACCEPTED');
}

export type ReferenceRead = { ok: true; reference: string } | { ok: false; problem: string };

/** The reference of a transfer, as the customer typed it. */
export function readTransferReference(text: unknown): ReferenceRead {
  const reference = typeof text === 'string' ? text.trim() : '';

  if (reference === '') return { ok: false, problem: 'Indiquez la référence de votre virement.' };
  if ([...reference].length > PAYMENT_REFERENCE_MAX) return { ok: false, problem: `La référence est trop longue (${PAYMENT_REFERENCE_MAX} caractères au plus).` };

  return { ok: true, reference };
}

const METHOD_WORDS: Record<string, string> = { CASH: 'Espèces', BANK_TRANSFER: 'Virement', ONLINE: 'Carte', ONLINE_CARD: 'Carte' };

const PAYMENT_STATUS_WORDS: Record<string, { words: string; tone: StatusTone }> = {
  AWAITING_CONFIRMATION: { words: 'En attente de confirmation', tone: 'warning' },
  PAID: { words: 'Reçu', tone: 'success' },
  PARTIALLY_REFUNDED: { words: 'Remboursé en partie', tone: 'info' },
  REFUNDED: { words: 'Remboursé', tone: 'info' },
  FAILED: { words: 'Échoué', tone: 'danger' },
};

export interface PaymentLine {
  id: number;
  methodText: string;
  amountText: string;
  statusWords: string;
  tone: StatusTone;
  dateText: string | null;
}

const ONLINE_WAYS: readonly string[] = ['ONLINE', 'ONLINE_CARD'];

/** How a payment is told: by its status, except that a request for cash or a transfer that is still "pending" waits for the team like the others. */
function paymentStatusOf(payment: Pick<TrackingInterventionPayment, 'status' | 'method'>): { words: string; tone: StatusTone } | undefined {
  if (payment.status === 'PENDING' && !ONLINE_WAYS.includes(payment.method)) return PAYMENT_STATUS_WORDS.AWAITING_CONFIRMATION;

  return PAYMENT_STATUS_WORDS[payment.status];
}

/** The payments the customer is told about: the ones that were asked for and not cancelled. A card request nobody could pay is not one. */
export function paymentLines(payments: readonly TrackingInterventionPayment[] | null | undefined): PaymentLine[] {
  return [...(payments ?? [])]
    .filter((payment) => paymentStatusOf(payment) !== undefined)
    .sort((a, b) => a.id - b.id)
    .map((payment) => {
      const status = paymentStatusOf(payment)!;

      return {
        id: payment.id,
        methodText: METHOD_WORDS[payment.method] ?? payment.method,
        amountText: moneyText(payment.amount, payment.currency),
        statusWords: status.words,
        tone: status.tone,
        dateText: dayText(payment.confirmedAt ?? payment.requestedAt ?? payment.createdAt),
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

/** What the page knows about where the PDF files are (the address of the server and the link of the request). */
export interface InvoiceDocumentOptions {
  pdf?: GuestPdfLinks | null;
}

/** The invoice as the page shows, prints and offers it; null when there is none (a draft is not the customer's, the server does not send it). */
export function invoiceDocument(invoice: TrackingInterventionInvoice | null | undefined, options: InvoiceDocumentOptions = {}): InvoiceDocument | null {
  if (!invoice || invoice.status === 'DRAFT') return null;

  const pdf = options.pdf ?? NO_PDF_LINKS;
  const paid = invoice.status === 'PAID' || invoice.paymentStatus === 'PAID';
  const paidDay = dayText(invoice.paidAt);
  // The PDF the server draws is the invoice as it stands; an uploaded file (an older invoice may have one) is the fallback.
  const link = pdf.invoice ?? pdfLink(invoice.pdfUrl);
  const { statusWords, tone } =
    invoice.status === 'CANCELLED'
      ? { statusWords: 'Facture annulée', tone: 'danger' as StatusTone }
      : paid
        ? { statusWords: paidDay ? `Payée le ${paidDay}` : 'Payée', tone: 'success' as StatusTone }
        : { statusWords: 'À payer', tone: 'warning' as StatusTone };
  const issued = dayText(invoice.issuedAt ?? invoice.sentAt ?? invoice.createdAt);
  const currency = invoice.currency;
  const stamp = amountOf(invoice.stampDuty);
  const credited = amountOf(invoice.creditedAmount);
  const toPay = amountOf(invoice.amountTTC) + stamp;
  const notes = [...(invoice.creditNotes ?? [])].sort((a, b) => a.id - b.id);
  const creditNotes: CreditNoteLine[] = notes.map((note) => {
    const day = dayText(note.issuedAt ?? note.createdAt);

    return {
      id: note.id,
      number: note.creditNoteNumber,
      issuedText: day ? `Émis le ${day}` : null,
      reason: text(note.reason),
      // A real minus sign (U+2212): a screen reader says "moins" for it, and drops a hyphen.
      amountText: `\u2212 ${moneyText(toDinars(amountOf(note.amountTTC) + amountOf(note.stampDuty)), currency)}`,
      href: pdf.creditNote(note.id),
    };
  });

  return {
    number: invoice.invoiceNumber,
    title: `Facture ${invoice.invoiceNumber}`,
    statusWords,
    tone,
    issuedText: issued ? `Émise le ${issued}` : null,
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
    lines: documentLines(invoice.items, currency),
    totals: {
      ...documentTotals(invoice),
      stampText: stamp > 0 ? moneyText(toDinars(stamp), currency) : null,
      toPayText: moneyText(toDinars(toPay), currency),
      toPayLabel: tone === 'warning' ? 'Total à payer' : 'Total facturé',
      creditNotes,
      netToPayText: credited > 0 || creditNotes.length > 0 ? moneyText(toDinars(Math.max(toPay - credited, 0)), currency) : null,
      netLabel: tone === 'warning' ? 'Net à payer' : 'Net de la facture',
    },
    legalMentions: text(invoice.legalMentions),
    paymentTerms: text(invoice.paymentTerms),
    notes: text(invoice.notes),
    download: link ? { kind: 'link', href: link } : { kind: 'print' },
    fileName: invoiceFileName(invoice.invoiceNumber),
  };
}
