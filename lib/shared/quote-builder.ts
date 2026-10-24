import type { ArtisanIntervention, ArtisanInterventionQuote } from './generated/views';
import { canonicalStatus, type CanonicalStatus } from './generated/intervention-status';
import { serviceNameOf } from './generated/trades';
import { categoryOfTrade, durationText, type PublicCategory, type PublicSubService } from './guest';
import {
  MAX_LINE_TOTAL,
  MAX_QUANTITY,
  MAX_UNIT_PRICE,
  MILLIMES_PER_DINAR,
  amountText,
  formatDinars,
  formatMillimes,
  lineTotalMillimes,
  readAmount,
  readQuantity,
  toDinars,
  toMillimes,
  totalsOf,
  type Totals,
} from './money';

/**
 * The quote an artisan makes on their phone (P2-05): what the screen starts from, what it checks before it sends, and
 * the body the server takes (POST /quotes/interventions/:id, PATCH /quotes/:id).
 *
 * The screen keeps what the person typed as text (`QuoteDraft`). `buildQuote` reads that text the way the server will
 * (money.ts), says in French what is wrong with each line, and gives the body only when nothing is. The total shown on
 * the screen and the total the server writes are worked out by the same rules, so they are the same number.
 */

/** The standard rate of value-added tax in Tunisia, in percent: the rate a quote starts with. */
export const DEFAULT_TAX_RATE = 19;

/** The rates the screen offers (percent). A quote that already has another rate keeps it as a choice too. */
export const TAX_RATE_CHOICES: readonly number[] = [19, 13, 7, 0];

/** How long a quote can be accepted, in days, and the length it starts with. */
export const VALIDITY_CHOICES: readonly number[] = [3, 7, 15, 30];
export const DEFAULT_VALIDITY_DAYS = 7;

/** More lines than this is a quote nobody reads, and keeps every sum far below the exact range of a number. */
export const MAX_QUOTE_LINES = 20;

const DAY_MS = 86_400_000;

export const QUOTE_LIMITS = { title: 120, label: 120, description: 1000 } as const;

export interface QuoteDraftLine {
  /** Only for the list on the screen. */
  key: string;
  label: string;
  /** As typed: "2", "1,5". */
  quantity: string;
  /** As typed, in dinars: "45", "12,500". */
  unitPrice: string;
  /** The words under the line that were written elsewhere (the back office): not typed on the phone, but kept when the quote is changed. */
  description?: string;
}

export interface QuoteDraft {
  title: string;
  description: string;
  /** Percent. */
  taxRate: number;
  /** Days from now; null leaves the date of an existing quote as it is (and gives a new one no date). */
  validDays: number | null;
  lines: QuoteDraftLine[];
}

/** What the server takes to make a quote, and to change one. */
export interface QuoteBody {
  title: string;
  description?: string;
  taxRate: number;
  expiresAt?: string;
  items: Array<{ label: string; description?: string; quantity: number; unitPrice: number }>;
}

let counter = 0;

/** A key for a line of the screen (unique for as long as the app runs). */
export function lineKey(): string {
  counter += 1;

  return `line-${counter}`;
}

export function newLine(overrides: Partial<Omit<QuoteDraftLine, 'key'>> = {}, key: () => string = lineKey): QuoteDraftLine {
  return { key: key(), label: '', quantity: '1', unitPrice: '', ...overrides };
}

// ----------------------------------------------------------
// Prices from the catalog
// ----------------------------------------------------------

export interface CatalogPrice {
  /** Dinars. */
  price: number;
  kind: 'emergency' | 'base';
}

const positive = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null);

/**
 * The price the catalog gives a sub-service for this job: the emergency price when the job is urgent and the catalog has
 * one, else the base price; null when the sub-service is "on quote" (no price).
 */
export function catalogPrice(sub: Pick<PublicSubService, 'basePrice' | 'emergencyPrice'> | null | undefined, urgency: string | null | undefined): CatalogPrice | null {
  if (!sub) return null;

  const emergency = positive(sub.emergencyPrice);
  const base = positive(sub.basePrice);

  if ((urgency === 'URGENT' || urgency === 'EMERGENCY') && emergency !== null) return { price: emergency, kind: 'emergency' };

  return base !== null ? { price: base, kind: 'base' } : null;
}

export type QuoteJob = Pick<ArtisanIntervention, 'serviceType' | 'urgency' | 'subService'>;

/** What the quote of a mission starts from: its sub-service, with the price of the catalog when there is one. */
export function prefillDraft(job: QuoteJob, key: () => string = lineKey): QuoteDraft {
  const sub = job.subService ?? null;
  const work = (sub?.name ?? '').trim() || serviceNameOf(job.serviceType).trim() || 'Intervention';
  const price = catalogPrice(sub, job.urgency);

  return {
    title: `Devis – ${work}`.slice(0, QUOTE_LIMITS.title),
    description: '',
    taxRate: DEFAULT_TAX_RATE,
    validDays: DEFAULT_VALIDITY_DAYS,
    lines: [newLine({ label: work.slice(0, QUOTE_LIMITS.label), unitPrice: price ? amountText(toMillimes(price.price)) : '' }, key)],
  };
}

/** The sentence under the first line: where its price comes from. */
export function prefillHint(job: QuoteJob): string {
  const price = catalogPrice(job.subService ?? null, job.urgency);

  if (!price) return 'Ce service est « sur devis » : indiquez votre prix.';

  return price.kind === 'emergency'
    ? `Prix du catalogue pour une urgence (${formatDinars(price.price)}). Ajustez-le si besoin.`
    : `Prix du catalogue (${formatDinars(price.price)}). Ajustez-le si besoin.`;
}

export interface CatalogChoice {
  id: number;
  name: string;
  /** Dinars, or null when it is on quote. */
  price: number | null;
  kind: CatalogPrice['kind'] | null;
  priceText: string;
  duration: string | null;
}

/** The sub-services of the trade of a job that a line can be added from, with their price for this job. */
export function catalogChoices(catalog: readonly PublicCategory[] | null | undefined, serviceType: string, urgency: string | null | undefined): CatalogChoice[] {
  const category = categoryOfTrade(catalog, serviceType);

  return (category?.subServices ?? []).map((sub) => {
    const price = catalogPrice(sub, urgency);

    return {
      id: sub.id,
      name: sub.name,
      price: price?.price ?? null,
      kind: price?.kind ?? null,
      priceText: price ? formatDinars(price.price) : 'Sur devis',
      duration: durationText(sub.estimatedDuration),
    };
  });
}

/** A line made from a choice of the catalog. */
export function lineFromChoice(choice: Pick<CatalogChoice, 'name' | 'price'>, key: () => string = lineKey): QuoteDraftLine {
  return newLine({ label: choice.name.slice(0, QUOTE_LIMITS.label), unitPrice: choice.price !== null ? amountText(toMillimes(choice.price)) : '' }, key);
}

/** A quote whose last day has passed: the customer can no longer accept it. */
function hasLapsed(quote: Pick<ArtisanInterventionQuote, 'expiresAt'>, now: Date): boolean {
  if (!quote.expiresAt) return false;

  const ends = new Date(quote.expiresAt).getTime();

  return !Number.isNaN(ends) && ends <= now.getTime();
}

/**
 * The validity a quote starts with when it is changed. A quote the customer sent back is sent again, and the server refuses to
 * send a quote whose date has passed: so when its date has passed, or ends within the usual length, it starts with a new
 * length (the usual one). A quote that is out and whose date has passed cannot be accepted any more, so changing it starts it
 * again with the usual length too. Any other quote keeps its date until the artisan picks another.
 */
export function startingValidity(quote: Pick<ArtisanInterventionQuote, 'status' | 'expiresAt'>, now: Date): number | null {
  if (!quote.expiresAt) return null;

  const ends = new Date(quote.expiresAt).getTime();

  if (quote.status === 'SENT') return Number.isNaN(ends) || ends <= now.getTime() ? DEFAULT_VALIDITY_DAYS : null;

  if (quote.status !== 'MODIFICATION_REQUESTED') return null;

  if (Number.isNaN(ends)) return DEFAULT_VALIDITY_DAYS;

  return ends - now.getTime() < DEFAULT_VALIDITY_DAYS * DAY_MS ? DEFAULT_VALIDITY_DAYS : null;
}

/** What a quote that exists is edited from. */
export function draftFromQuote(quote: ArtisanInterventionQuote, key: () => string = lineKey, now: Date = new Date()): QuoteDraft {
  return {
    title: quote.title,
    description: quote.description ?? '',
    taxRate: quote.taxRate,
    validDays: startingValidity(quote, now),
    lines: (quote.items ?? []).map((item) =>
      newLine(
        {
          label: item.label,
          // The exact text of the number: a quantity with a third decimal (older data) shows as it is, and is refused until it is put right.
          quantity: String(Number(item.quantity)).replace('.', ','),
          unitPrice: amountText(toMillimes(item.unitPrice)),
          // Kept as it is, so that a change of the price does not wipe the words under the line.
          ...(item.description ? { description: item.description } : {}),
        },
        key,
      ),
    ),
  };
}

/** The rates to offer: the usual ones, and the rate the quote already has when it is another. */
export function taxRateChoices(current: number): number[] {
  return TAX_RATE_CHOICES.includes(current) ? [...TAX_RATE_CHOICES] : [...TAX_RATE_CHOICES, current].sort((a, b) => b - a);
}

// ----------------------------------------------------------
// Reading what was typed
// ----------------------------------------------------------

export type QuoteField = 'title' | 'description' | 'tax' | 'validity' | 'lines' | 'label' | 'quantity' | 'unitPrice' | 'total' | 'quote';

export interface QuoteProblem {
  field: QuoteField;
  /** The index in `draft.lines`, or null when the problem is not a line's. */
  line: number | null;
  message: string;
}

/** A line the person added and left empty is not a mistake: it is dropped. */
export function isBlankLine(line: Pick<QuoteDraftLine, 'label' | 'unitPrice'>): boolean {
  return line.label.trim() === '' && line.unitPrice.trim() === '';
}

const QUANTITY_WORDS = {
  empty: 'Indiquez la quantité.',
  format: 'Quantité invalide : écrivez par exemple 1 ou 2,5.',
  decimals: 'Une quantité a au plus deux décimales.',
  zero: 'La quantité doit être supérieure à 0.',
  'too-big': `La quantité ne peut pas dépasser ${MAX_QUANTITY}.`,
} as const;

const PRICE_WORDS = {
  empty: 'Indiquez le prix unitaire.',
  format: 'Prix invalide : écrivez par exemple 45 ou 45,500.',
  decimals: 'Un prix a au plus trois décimales (millimes).',
  'too-big': `Le prix ne peut pas dépasser ${formatDinars(MAX_UNIT_PRICE)}.`,
} as const;

interface ReadLine {
  index: number;
  unitMillimes: number;
  quantityHundredths: number;
}

export interface QuoteReading {
  problems: QuoteProblem[];
  /** The lines that could be read, whatever the other lines are. */
  lines: ReadLine[];
}

function validRate(rate: unknown): rate is number {
  return typeof rate === 'number' && Number.isFinite(rate) && rate >= 0 && rate <= 100 && Math.round(rate * 100) / 100 === rate;
}

/** Reads a draft the way the server will, and lists everything that is wrong with it. */
export function readQuote(draft: QuoteDraft): QuoteReading {
  const problems: QuoteProblem[] = [];
  const title = draft.title.trim();

  if (title === '') problems.push({ field: 'title', line: null, message: 'Donnez un titre au devis.' });
  else if (title.length > QUOTE_LIMITS.title) problems.push({ field: 'title', line: null, message: `Le titre est trop long (${QUOTE_LIMITS.title} caractères au plus).` });

  if (draft.description.trim().length > QUOTE_LIMITS.description) {
    problems.push({ field: 'description', line: null, message: `La description est trop longue (${QUOTE_LIMITS.description} caractères au plus).` });
  }

  if (!validRate(draft.taxRate)) problems.push({ field: 'tax', line: null, message: 'Taux de TVA invalide : de 0 à 100 %, avec au plus deux décimales.' });

  if (draft.validDays !== null && !(Number.isInteger(draft.validDays) && draft.validDays >= 1 && draft.validDays <= 365)) {
    problems.push({ field: 'validity', line: null, message: 'La durée de validité doit être de 1 à 365 jours.' });
  }

  const kept = draft.lines.map((line, index) => ({ line, index })).filter(({ line }) => !isBlankLine(line));

  if (kept.length === 0) problems.push({ field: 'lines', line: null, message: 'Ajoutez au moins une ligne au devis.' });
  else if (kept.length > MAX_QUOTE_LINES) problems.push({ field: 'lines', line: null, message: `Un devis ne peut pas avoir plus de ${MAX_QUOTE_LINES} lignes.` });

  const lines: ReadLine[] = [];

  for (const { line, index } of kept) {
    const label = line.label.trim();
    const quantity = readQuantity(line.quantity);
    const price = readAmount(line.unitPrice);
    let fine = true;

    if (label === '') {
      problems.push({ field: 'label', line: index, message: 'Indiquez ce que couvre cette ligne.' });
      fine = false;
    } else if (label.length > QUOTE_LIMITS.label) {
      problems.push({ field: 'label', line: index, message: `Le libellé est trop long (${QUOTE_LIMITS.label} caractères au plus).` });
      fine = false;
    }

    if (!quantity.ok) {
      problems.push({ field: 'quantity', line: index, message: QUANTITY_WORDS[quantity.problem] });
    }

    if (!price.ok) {
      problems.push({ field: 'unitPrice', line: index, message: PRICE_WORDS[price.problem] });
    }

    if (quantity.ok && price.ok) {
      if (lineTotalMillimes(price.millimes, quantity.hundredths) > MAX_LINE_TOTAL * MILLIMES_PER_DINAR) {
        problems.push({ field: 'total', line: index, message: `Une ligne ne peut pas dépasser ${formatDinars(MAX_LINE_TOTAL)}.` });
        fine = false;
      }

      if (fine) lines.push({ index, unitMillimes: price.millimes, quantityHundredths: quantity.hundredths });
    }
  }

  return { problems, lines };
}

export interface QuotePreview {
  /** The total of each line of the draft, or null for a line that cannot be read yet. */
  lines: Array<number | null>;
  amountHT: number;
  taxAmount: number;
  amountTTC: number;
  /** Whether everything could be read, so that these are the figures that will be sent. */
  complete: boolean;
}

/** The total shown under the lines as the person types: the lines that can be read are added, the others wait. */
export function previewOf(draft: QuoteDraft): QuotePreview {
  const { problems, lines } = readQuote(draft);
  const totals = totalsOf(lines, validRate(draft.taxRate) ? draft.taxRate : 0);

  return {
    lines: draft.lines.map((_, index) => {
      const position = lines.findIndex((line) => line.index === index);

      return position === -1 ? null : totals.lines[position];
    }),
    amountHT: totals.amountHT,
    taxAmount: totals.taxAmount,
    amountTTC: totals.amountTTC,
    complete: problems.length === 0,
  };
}

export type QuoteBuild = { ok: true; body: QuoteBody; totals: Totals } | { ok: false; problems: QuoteProblem[] };

/**
 * The body to send, or everything that is wrong. `create` leaves the description out when it is empty; `update` always sends
 * it (an empty text clears it, and nothing leaves the old one). The date a quote can be accepted until counts from `now`.
 */
export function buildQuote(draft: QuoteDraft, now: Date, mode: 'create' | 'update' = 'create'): QuoteBuild {
  const { problems, lines } = readQuote(draft);

  if (problems.length > 0) return { ok: false, problems };

  const totals = totalsOf(lines, draft.taxRate);

  if (totals.amountHT <= 0) return { ok: false, problems: [{ field: 'quote', line: null, message: 'Le total du devis doit être supérieur à 0.' }] };

  const description = draft.description.trim();
  const body: QuoteBody = {
    title: draft.title.trim(),
    taxRate: draft.taxRate,
    items: lines.map((line) => {
      const description = draft.lines[line.index].description;

      return {
        label: draft.lines[line.index].label.trim(),
        ...(description ? { description } : {}),
        quantity: line.quantityHundredths / 100,
        unitPrice: toDinars(line.unitMillimes),
      };
    }),
  };

  if (mode === 'update' || description !== '') body.description = description;

  if (draft.validDays !== null) body.expiresAt = new Date(now.getTime() + draft.validDays * DAY_MS).toISOString();

  return { ok: true, body, totals };
}

/**
 * After a call whose answer never came: the quote that went through, if it did. The mission is read again, and a quote that was
 * not there before, with the same title and the same total, is the one that was sent.
 */
export function quoteThatArrived(
  before: ReadonlyArray<{ id: number }>,
  after: ReadonlyArray<ArtisanInterventionQuote> | null | undefined,
  sent: { title: string; amountTTC: number },
): ArtisanInterventionQuote | null {
  const known = new Set(before.map((quote) => quote.id));

  return (after ?? []).find((quote) => !known.has(quote.id) && quote.title === sent.title && toMillimes(quote.amountTTC) === sent.amountTTC) ?? null;
}

// ----------------------------------------------------------
// Where a mission stands with its quote
// ----------------------------------------------------------

/** The statuses of a mission in which its artisan may make a quote: accepted, on the way, on site, at work. */
const QUOTING_STATUSES: readonly CanonicalStatus[] = ['ARTISAN_ACCEPTED', 'ARTISAN_ON_THE_WAY', 'ARTISAN_ARRIVED', 'IN_PROGRESS'];

export function canQuote(status: string | null | undefined): boolean {
  const canonical = canonicalStatus(status);

  return canonical !== null && QUOTING_STATUSES.includes(canonical);
}

export type QuoteStage = 'none' | 'waiting' | 'expired' | 'changes' | 'accepted';

export interface QuoteState {
  stage: QuoteStage;
  /** The quote the card talks about: the accepted one, else the one the customer has to answer, else the last. */
  quote: ArtisanInterventionQuote | null;
  /** The screen may start a new quote. */
  canCreate: boolean;
  /** The screen may change the quote that is out. */
  canEdit: boolean;
  /**
   * The quote that is out was sent back for a change: the customer cannot accept it until the artisan has changed it and sent it
   * again, so a change is followed by a new sending (`routes.quotes.send`).
   */
  resend: boolean;
  /** One sentence for the card. */
  words: string;
}

const byNewest = (a: ArtisanInterventionQuote, b: ArtisanInterventionQuote) => b.id - a.id;

/** Where the mission is with its quote, and what the artisan can do about it. `now` is the moment the dates are read against. */
export function quoteState(job: { status?: string | null; quotes?: ArtisanIntervention['quotes'] }, now: Date = new Date()): QuoteState {
  const quotes = [...(job.quotes ?? [])].sort(byNewest);
  const open = canQuote(job.status);
  const accepted = quotes.find((quote) => quote.status === 'ACCEPTED');

  // Payments follow the accepted quote: a second one beside it would be taken for the price, so none is offered.
  if (accepted) return { stage: 'accepted', quote: accepted, canCreate: false, canEdit: false, resend: false, words: 'Devis accepté par le client.' };

  const out = quotes.find((quote) => quote.status === 'SENT' || quote.status === 'MODIFICATION_REQUESTED');

  if (out) {
    // Nothing turns a sent quote into an expired one by itself: its date is read here, so that the card does not say "waiting" for
    // an answer the customer can no longer give.
    if (out.status === 'SENT' && hasLapsed(out, now)) {
      const gone = 'Le devis envoyé est arrivé à échéance : le client ne peut plus l’accepter.';

      return { stage: 'expired', quote: out, canCreate: false, canEdit: open, resend: false, words: open ? `${gone} Modifiez-le pour lui donner une nouvelle durée de validité.` : gone };
    }

    if (out.status === 'SENT') {
      return { stage: 'waiting', quote: out, canCreate: false, canEdit: open, resend: false, words: 'Devis envoyé : le client n’a pas encore répondu.' };
    }

    return {
      stage: 'changes',
      quote: out,
      canCreate: false,
      canEdit: open,
      resend: true,
      words: open
        ? 'Le client demande une modification du devis : changez-le, il sera renvoyé au client.'
        : 'Le client demande une modification du devis, mais vous ne pouvez plus le modifier à ce stade de la mission : contactez l’administration.',
    };
  }

  const last = quotes[0] ?? null;
  const words =
    last?.status === 'REJECTED'
      ? 'Le dernier devis a été refusé par le client.'
      : last?.status === 'EXPIRED'
        ? 'Le dernier devis a expiré.'
        : last?.status === 'CANCELLED'
          ? 'Le dernier devis a été annulé.'
          : 'Aucun devis envoyé pour cette mission.';

  return { stage: 'none', quote: last, canCreate: open, canEdit: false, resend: false, words };
}

/**
 * Why the quote screen cannot open for this mission, in a sentence, or null when it can. `editing` is the number of the quote the
 * screen was opened to change, or null when it was opened to make one. The screen asks after reading the mission, because a link
 * to it can be opened late: the customer may have answered, or the mission may have moved on.
 */
export function quoteBlock(job: { status?: string | null; quotes?: ArtisanIntervention['quotes'] }, editing: number | null): string | null {
  const state = quoteState(job);

  if (editing !== null) {
    if (state.quote?.id === editing && state.canEdit) return null;
    if (state.stage === 'accepted') return 'Ce devis a été accepté par le client : il ne peut plus être modifié.';
    if (!(job.quotes ?? []).some((quote) => quote.id === editing)) return 'Ce devis n’existe plus.';

    return 'Ce devis ne peut plus être modifié.';
  }

  if (state.canCreate) return null;
  if (state.stage === 'accepted') return 'Le client a déjà accepté un devis pour cette mission.';
  if (state.stage !== 'none') return 'Un devis est déjà en cours pour cette mission : modifiez-le depuis la mission.';

  return 'Un devis peut être établi entre l’acceptation de la mission et la fin des travaux.';
}

/** The one-line total of a quote: "119,000 DT TTC". */
export function quoteTotalText(quote: Pick<ArtisanInterventionQuote, 'amountTTC'>): string {
  return `${formatMillimes(toMillimes(quote.amountTTC))} TTC`;
}
