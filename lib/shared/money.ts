/**
 * Amounts as a person types and reads them (P2-05), exact to the millime.
 *
 * The server keeps every amount in dinars with three decimals (DECIMAL(14,3)) and does its sums in whole millimes
 * (src/common/money/money.ts there). The apps do the same, so that the total on the phone is the total the server writes:
 * a price is typed as text ("12,5" or "12.500"), read as a whole number of millimes, and added up and rounded once, the way the
 * server does (half up, on the millime). Nothing here goes through a float product.
 *
 * Every product below stays under 2^53, which is what makes the integer arithmetic exact: the limits that guarantee it
 * (`MAX_UNIT_PRICE`, `MAX_QUANTITY`, `MAX_LINE_TOTAL`, and 20 lines per quote in quote-builder) are tighter than the server's.
 */

export const MILLIMES_PER_DINAR = 1000;

/** The dearest unit price a line accepts, in dinars. */
export const MAX_UNIT_PRICE = 100_000;

/** The largest quantity of a line. */
export const MAX_QUANTITY = 1_000;

/** The most a single line may come to, in dinars. */
export const MAX_LINE_TOTAL = 1_000_000;

export type AmountProblem = 'empty' | 'format' | 'decimals' | 'too-big';

export type AmountRead = { ok: true; millimes: number } | { ok: false; problem: AmountProblem };

export type QuantityProblem = AmountProblem | 'zero';

export type QuantityRead = { ok: true; hundredths: number } | { ok: false; problem: QuantityProblem };

/**
 * Marks that a paste can carry and that nobody sees: the direction marks of text copied from an Arabic page (LRM, RLM, ALM,
 * the embeddings and isolates), the zero-width characters and the byte order mark. They are dropped before the text is read.
 */
const INVISIBLE = /[\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\u061c\ufeff]/g;

/**
 * One space (a keyboard space, a no-break space, a narrow one) between the groups of thousands. The first group does not begin
 * with a zero: "0 500" is not five hundred (it would be 1 000 times what someone who meant 0,500 typed).
 */
const GROUPED = /^[1-9]\d{0,2}(?:\s\d{3})+(?:[.,]\d*)?$/;

/** Digits, then at most one comma or dot and more digits ("12", "12,5", ".5", "12."). */
const NUMBER_TEXT = /^(\d*)(?:[.,](\d*))?$/;

interface Parts {
  whole: string;
  fraction: string;
}

/** The digits and the decimal mark of an Arabic or Persian keyboard, as Latin ones. */
function latin(text: string): string {
  return text
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[\u066B\u060C]/g, ',');
}

function partsOf(text: unknown): Parts | AmountProblem {
  const typed = latin(String(text ?? '')).replace(INVISIBLE, '').trim();

  // Spaces are read as thousands marks only between groups of three digits: "1 234,5" is 1234,5 but "12 5" is no amount (it
  // would have been read as 125). Spaces anywhere else (around the decimal mark, after the last digit) are not a number either.
  if (/\s/.test(typed) && !GROUPED.test(typed)) return 'format';

  const compact = typed.replace(/\s/g, '');

  if (compact === '') return 'empty';

  const match = NUMBER_TEXT.exec(compact);

  if (!match || (match[1] === '' && (match[2] ?? '') === '')) return 'format';

  // Zeros after the last meaningful decimal change nothing ("12,5000" is 12,5).
  return { whole: match[1] || '0', fraction: (match[2] ?? '').replace(/0+$/, '') };
}

/**
 * An amount in dinars as the person typed it, read as whole millimes. A comma is always the decimal mark (never a thousands
 * separator), a sign or an exponent is not an amount, and a fourth decimal is refused, not rounded: the server refuses it too.
 */
export function readAmount(text: unknown, maxDinars: number = MAX_UNIT_PRICE): AmountRead {
  const parts = partsOf(text);

  if (typeof parts === 'string') return { ok: false, problem: parts };
  if (parts.fraction.length > 3) return { ok: false, problem: 'decimals' };
  if (parts.whole.replace(/^0+/, '').length > 12) return { ok: false, problem: 'too-big' };

  const millimes = Number(parts.whole) * MILLIMES_PER_DINAR + Number(parts.fraction.padEnd(3, '0'));

  // The limit is rounded to whole millimes first: 16.15 * 1000 is 16149.999999999998, which would refuse an amount of exactly 16,150.
  return millimes > Math.round(maxDinars * MILLIMES_PER_DINAR) ? { ok: false, problem: 'too-big' } : { ok: true, millimes };
}

/** A quantity as typed ("2", "1,5", "0.25"): more than 0, with at most two decimals, read as hundredths. */
export function readQuantity(text: unknown, max: number = MAX_QUANTITY): QuantityRead {
  const parts = partsOf(text);

  if (typeof parts === 'string') return { ok: false, problem: parts };
  if (parts.fraction.length > 2) return { ok: false, problem: 'decimals' };
  if (parts.whole.replace(/^0+/, '').length > 9) return { ok: false, problem: 'too-big' };

  const hundredths = Number(parts.whole) * 100 + Number(parts.fraction.padEnd(2, '0'));

  if (hundredths === 0) return { ok: false, problem: 'zero' };

  return hundredths > max * 100 ? { ok: false, problem: 'too-big' } : { ok: true, hundredths };
}

/** The amount the server sent (dinars, up to three decimals) as whole millimes. */
export function toMillimes(dinars: number): number {
  return Math.round(dinars * MILLIMES_PER_DINAR);
}

/** Whole millimes as the amount the server takes (dinars). */
export function toDinars(millimes: number): number {
  return millimes / MILLIMES_PER_DINAR;
}

/** One line: the unit price times the quantity, rounded once to the millime (half up). */
export function lineTotalMillimes(unitMillimes: number, quantityHundredths: number): number {
  return Math.floor((unitMillimes * quantityHundredths + 50) / 100);
}

/** The tax on an amount, rounded once to the millime (half up). The rate is in hundredths of a percent: 19 % is 1900. */
export function taxMillimes(amountMillimes: number, rateHundredths: number): number {
  return Math.floor((amountMillimes * rateHundredths + 5000) / 10_000);
}

/** A percent as hundredths of a percent (19 gives 1900, 7.5 gives 750). */
export function rateHundredths(percent: number): number {
  return Math.round(percent * 100);
}

export interface Totals {
  /** The total of each line, in the order of the lines. */
  lines: number[];
  amountHT: number;
  taxAmount: number;
  amountTTC: number;
}

/**
 * The three amounts of a quote, in millimes: the sum of the lines, the tax on it rounded once, and the total, which is exactly
 * the two added (the same rule as the server's `vatTotals`).
 */
export function totalsOf(lines: ReadonlyArray<{ unitMillimes: number; quantityHundredths: number }>, ratePercent: number): Totals {
  const totals = lines.map((line) => lineTotalMillimes(line.unitMillimes, line.quantityHundredths));
  const amountHT = totals.reduce((sum, total) => sum + total, 0);
  const taxAmount = taxMillimes(amountHT, rateHundredths(ratePercent));

  return { lines: totals, amountHT, taxAmount, amountTTC: amountHT + taxAmount };
}

const NBSP = ' ';

/**
 * Whole millimes as the money screens write them: three decimals, a comma, thousands set apart ("1 234,500 DT"). A minus sign
 * stays attached to the figure.
 */
export function formatMillimes(millimes: number, unit = 'DT'): string {
  const rounded = Math.round(millimes);
  const negative = rounded < 0;
  const magnitude = Math.abs(rounded);
  const whole = String(Math.floor(magnitude / MILLIMES_PER_DINAR)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const fraction = String(magnitude % MILLIMES_PER_DINAR).padStart(3, '0');

  return `${negative ? '-' : ''}${whole},${fraction}${NBSP}${unit}`;
}

/** An amount in dinars (as the server sends it) written as `formatMillimes` does. */
export function formatDinars(dinars: number, unit = 'DT'): string {
  return formatMillimes(toMillimes(dinars), unit);
}

/** A quantity in hundredths as it is written ("2", "1,5", "0,25"). */
export function formatQuantity(hundredths: number): string {
  const whole = Math.floor(hundredths / 100);
  const fraction = String(hundredths % 100).padStart(2, '0').replace(/0+$/, '');

  return fraction ? `${whole},${fraction}` : String(whole);
}

/** Millimes as an amount to type back into a field ("12,5", "12", "0,001"): no unit, no grouping. */
export function amountText(millimes: number): string {
  const whole = Math.floor(millimes / MILLIMES_PER_DINAR);
  const fraction = String(millimes % MILLIMES_PER_DINAR).padStart(3, '0').replace(/0+$/, '');

  return fraction ? `${whole},${fraction}` : String(whole);
}
