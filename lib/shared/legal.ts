import { dayText } from './customer';
import { LOCALES, type Locale } from './generated/i18n';
import { message, messageText, type MessageKey } from './i18n';

/**
 * The terms and the privacy text of the website, and the consent line of the request form (P3-08).
 *
 * The words are in the catalogue (`legal`, `website.request.notice` / `website.request.consent`, `website.join.form.privacyLine`); this file is
 * what the pages and the tests share: which texts there are, where they are read, how a body is cut into paragraphs and lists, which passages
 * are still to be filled in or checked, and whether the texts may be shown as reviewed.
 *
 * Nothing here is legal advice. The texts are a draft built on what the service does; they are shown as a draft, and kept out of the search
 * engines, until `LEGAL_REVIEW` says that somebody has read exactly these words, and until no passage is left open in ANY of them. The rule fails
 * closed: a square bracket (the ASCII, fullwidth and corner forms) is an open passage, so a mark that was retyped in a way nobody foresaw keeps the draft banner
 * up instead of making a gap disappear.
 */

export const LEGAL_DOCUMENTS = ['terms', 'privacy'] as const;
export type LegalDocument = (typeof LEGAL_DOCUMENTS)[number];

/** The address of each text on the website: the same in both languages (the language is the visitor's choice, not part of the address). */
export const LEGAL_PATHS: Readonly<Record<LegalDocument, string>> = {
  terms: '/conditions',
  privacy: '/confidentialite',
};

/** The sections of each text, in the order they are read; the catalogue has `legal.<document>.sections.<id>.title` and `.body` for each. */
export const LEGAL_SECTIONS: Readonly<Record<LegalDocument, readonly string[]>> = {
  terms: ['parties', 'request', 'quote', 'payment', 'cancellation', 'responsibility', 'complaints', 'data', 'law', 'changes'],
  privacy: ['controller', 'collected', 'purposes', 'recipients', 'retention', 'rights', 'cookies', 'applicants', 'changes', 'contact'],
};

/**
 * The other words that belong to the same review: what the pages say around the texts, the notices and the consent lines of the forms, and the
 * sentences of the website that tell the visitor where a piece of data goes (the SMS with the tracking link, the card payment, the publication
 * of an opinion) or promise something the terms speak of (a quote, a call back). A passage left open in one of them keeps every text a draft,
 * the reviewer reads them with the texts, and they are part of the fingerprint.
 *
 * What is ENFORCED is narrower than that: a test fails when a key of the `legal` namespace, of `website.request.notice` or of
 * `website.request.consent` is not in the list. Any other sentence of the website that speaks of the data or of a commitment is in the list
 * only because somebody put it there: when you write or change one, add it (the sentences of the home page, such as "Sans compte", are not in it).
 */
export const LEGAL_FORM_KEYS = [
  'legal.draft.title',
  'legal.draft.text',
  'legal.version',
  'legal.draftVersion',
  'legal.back',
  'legal.other',
  'legal.contents',
  'website.request.notice.place',
  'website.request.notice.phone',
  'website.request.notice.more',
  'website.request.newTab',
  'website.request.consent.line',
  'website.request.consent.informLine',
  'website.request.consent.terms',
  'website.request.consent.privacy',
  'website.request.locate.help',
  'website.request.done.linkNote',
  'website.savedRequests.note',
  'website.join.form.privacyLine',
  'website.join.form.documentsNote',
  'website.request.phone.help',
  'website.request.done.body',
  'website.request.service.pricesNote',
  'website.panels.problem.lateAsk',
  'website.panels.problem.placeholder',
  'website.panels.feedback.note',
  'website.panels.thanks.note',
  'website.payment.cardSecure',
  'website.quote.form.accept.hint',
] as const satisfies readonly MessageKey[];

// ----------------------------------------------------------
// The review
// ----------------------------------------------------------

/**
 * Whether the texts were read by somebody who may say so. To change when the lawyer's texts are in the catalogue (the steps are in the README of
 * this package, "Publishing the real texts"): `reviewed: true`, the name of whoever read them, the day they did (YYYY-MM-DD, not before
 * `version`), and `fingerprint`, which is the one of the words they read (the test of the real texts prints it once no passage is left open):
 * editing a word afterwards makes the texts drafts again until somebody reads them again, and `version`, the date of the texts shown to the
 * visitor, is moved to the day of every new reading.
 */
export interface LegalReview {
  readonly reviewed: boolean;
  readonly reviewedBy: string | null;
  readonly reviewedOn: string | null;
  readonly version: string;
  readonly fingerprint: string | null;
}

export const LEGAL_REVIEW: Readonly<LegalReview> = Object.freeze({
  reviewed: false,
  reviewedBy: null,
  reviewedOn: null,
  version: '2026-11-01',
  fingerprint: null,
});

/** A real day written YYYY-MM-DD: the 31st of February is not one (it would be read as the 3rd of March), and any other way of writing a day is not either. */
export function isLegalDay(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const time = Date.parse(`${value}T00:00:00Z`);

  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/** A name worth the word: at least three letters, not a placeholder, and not an open passage ("[À COMPLÉTER]", "TODO reviewer"). */
function isName(value: unknown): boolean {
  if (typeof value !== 'string' || legalGaps(value).length > 0) return false;

  const letters = value.match(/\p{L}/gu) ?? [];

  return letters.length >= 3 && !/^(?:todo|tbd|fixme|xxx|none|nobody|n\/a)$/iu.test(value.trim());
}

/** What the review is checked against: the passages still open in all the words under review, and the fingerprint of those words. */
export interface LegalState {
  gapCount: number;
  fingerprint: string;
}

/**
 * The rule behind the status, on its own: the flag is up, somebody is named, the day is a real day that is not before the version of the texts
 * (nor after `today`, when it is given: a `today` that is not a real day fails closed), no passage is open, and the words are the ones that
 * were read. The pages and the request form give no `today`: a clock in the form would not read the same on the server and in the browser, so
 * "not after today" is held by the tests of the real texts, not at run time.
 */
export function isLegalReviewed(review: Readonly<LegalReview>, state: LegalState, today?: string): boolean {
  if (review.reviewed !== true || !isName(review.reviewedBy)) return false;
  if (!isLegalDay(review.reviewedOn) || !isLegalDay(review.version)) return false;
  if (review.reviewedOn < review.version) return false;
  if (today !== undefined && (!isLegalDay(today) || review.reviewedOn > today)) return false;

  return state.gapCount === 0 && review.fingerprint !== null && review.fingerprint === state.fingerprint;
}

// ----------------------------------------------------------
// A body: paragraphs and lists
// ----------------------------------------------------------

export type LegalBlock = { kind: 'paragraph'; text: string } | { kind: 'list'; items: string[] };

/**
 * A body cut into what the page draws. Paragraphs are separated by an empty line; consecutive lines that start with "- " make one list, and an
 * indented line under an item goes on with that item; other consecutive lines are one paragraph. Nothing is interpreted beyond that: no markup,
 * no link.
 */
export function legalBlocks(body: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const endParagraph = () => {
    if (paragraph.length > 0) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });

    paragraph = [];
  };

  const endList = () => {
    if (list.length > 0) blocks.push({ kind: 'list', items: list });

    list = [];
  };

  for (const raw of body.split(/\r\n|\r|\n|\u2028|\u2029/)) {
    const line = raw.trim();

    if (line === '') {
      endParagraph();
      endList();
    } else if (line.startsWith('- ')) {
      endParagraph();
      list.push(line.slice(2).trim());
    } else if (list.length > 0 && /^\s/.test(raw)) {
      list[list.length - 1] += ` ${line}`;
    } else {
      endList();
      paragraph.push(line);
    }
  }

  endParagraph();
  endList();

  return blocks;
}

// ----------------------------------------------------------
// The passages that are not decided yet
// ----------------------------------------------------------

/** The four marks a passage to fill in or to check starts with: [À COMPLÉTER : …] and [يُستكمل: …] (to fill in), [À VÉRIFIER : …] and [يُراجع: …] (to check). */
export const LEGAL_MARKS = ['À COMPLÉTER', 'À VÉRIFIER', 'يُستكمل', 'يُراجع'] as const;

/**
 * What is not decided: a bracketed passage whatever is inside it (so a mark typed in an unforeseen way is still one), a bracket on its own (a
 * passage cut by an empty line, or closed twice), square brackets in the fullwidth and the corner forms (those listed in the expression below, not every bracket Unicode has), and the words TODO, TBD, FIXME and XXX.
 * The pages draw them all as open passages. So a final text cannot hold a square bracket (write "(bis)", not "[bis]") nor the word XXX (the
 * Roman number thirty: write 30). What a bare "À COMPLÉTER" or "(à compléter)" is, nothing here can tell from a sentence: the tests of the real
 * texts look for the four marks written without their brackets, and the human review is the net for the rest.
 */
const OPEN = /\[[^\]]*\]|［[^］]*］|【[^】]*】|[\[\]［］【】]|\b(?:TODO|TBD|FIXME|XXX)\b/giu;

export function legalGaps(text: string): string[] {
  return text.match(OPEN) ?? [];
}

export type LegalSegment = { kind: 'text' | 'gap'; text: string };

/** A line cut where the passages to fill in or check are, so that a draft can show them: the pieces put back together give the line. */
export function legalSegments(text: string): LegalSegment[] {
  const segments: LegalSegment[] = [];
  let from = 0;

  for (const found of text.matchAll(OPEN)) {
    const at = found.index ?? 0;

    if (at > from) segments.push({ kind: 'text', text: text.slice(from, at) });

    segments.push({ kind: 'gap', text: found[0] });
    from = at + found[0].length;
  }

  if (from < text.length) segments.push({ kind: 'text', text: text.slice(from) });

  return segments;
}

// ----------------------------------------------------------
// A text, read from the catalogue
// ----------------------------------------------------------

export interface LegalSection {
  id: string;
  title: string;
  blocks: LegalBlock[];
}

export interface LegalText {
  locale: Locale;
  document: LegalDocument;
  title: string;
  intro: string;
  sections: LegalSection[];
}

const textOf = (locale: Locale, key: string): string => messageText(locale, key) ?? '';

/** One text in one language, section by section (French where Arabic lacks a key, as everywhere in the catalogue). */
export function legalText(locale: Locale, document: LegalDocument): LegalText {
  return {
    locale,
    document,
    title: textOf(locale, `legal.${document}.title`),
    intro: textOf(locale, `legal.${document}.intro`),
    sections: LEGAL_SECTIONS[document].map((id) => ({
      id,
      title: textOf(locale, `legal.${document}.sections.${id}.title`),
      blocks: legalBlocks(textOf(locale, `legal.${document}.sections.${id}.body`)),
    })),
  };
}

/** Every passage left to fill in or check in a text already read, in reading order: its title and introduction, then each section's title, paragraphs and list items. */
export function legalTextGaps(text: LegalText): string[] {
  const found = [...legalGaps(text.title), ...legalGaps(text.intro)];

  for (const section of text.sections) {
    found.push(...legalGaps(section.title));

    for (const block of section.blocks) {
      if (block.kind === 'paragraph') found.push(...legalGaps(block.text));
      else for (const item of block.items) found.push(...legalGaps(item));
    }
  }

  return found;
}

/** Every passage left to fill in or check in one text in one language, in reading order. */
export function legalGapsOf(locale: Locale, document: LegalDocument): string[] {
  return legalTextGaps(legalText(locale, document));
}

// ----------------------------------------------------------
// The status of the whole set
// ----------------------------------------------------------

/** All the words under review: the four texts (each document in each language) and the lines of the pages and forms around them. */
export interface LegalInputs {
  texts: readonly LegalText[];
  lines: readonly string[];
}

let realInputs: LegalInputs | undefined;

/** The words of the catalogue under review (read once: the catalogue does not change while the program runs). */
export function legalInputs(): LegalInputs {
  realInputs ??= {
    texts: LOCALES.flatMap((locale) => LEGAL_DOCUMENTS.map((document) => legalText(locale, document))),
    lines: LOCALES.flatMap((locale) => LEGAL_FORM_KEYS.map((key) => textOf(locale, key))),
  };

  return realInputs;
}

/** A short fingerprint of a string (cyrb53: no secrecy, only "were these the words that were read?"; it needs nothing of the platform). */
function hash(value: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/** The fingerprint of the words under review: any edit of any of them, in either language, gives another one. */
export function legalFingerprint(inputs: LegalInputs = legalInputs()): string {
  return hash(
    JSON.stringify([
      inputs.texts.map((text) => [text.locale, text.document, text.title, text.intro, text.sections.map((section) => [section.id, section.title, section.blocks])]),
      inputs.lines,
    ]),
  );
}

/** Every passage left open in the words under review, wherever it stands. */
export function legalSetGaps(inputs: LegalInputs = legalInputs()): string[] {
  return [...inputs.texts.flatMap((text) => legalTextGaps(text)), ...inputs.lines.flatMap((line) => legalGaps(line))];
}

export interface LegalSetStatus {
  reviewed: boolean;
  gaps: string[];
  fingerprint: string;
}

/**
 * Whether the texts may be shown as reviewed. One answer for the whole set: if a passage is open in the Arabic privacy text, the French terms are
 * a draft too, because the reviewer's word covers all of them or none.
 */
export function legalSetStatus(review: Readonly<LegalReview> = LEGAL_REVIEW, inputs: LegalInputs = legalInputs(), today?: string): LegalSetStatus {
  const gaps = legalSetGaps(inputs);
  const fingerprint = legalFingerprint(inputs);

  return { reviewed: isLegalReviewed(review, { gapCount: gaps.length, fingerprint }, today), gaps, fingerprint };
}

/** The status of one text: whether it may be shown as reviewed (the answer of the whole set) and the passages open in this text. */
export function legalStatus(
  locale: Locale,
  document: LegalDocument,
  review: Readonly<LegalReview> = LEGAL_REVIEW,
  inputs: LegalInputs = legalInputs(),
): { reviewed: boolean; gaps: string[] } {
  const own = inputs.texts.find((text) => text.locale === locale && text.document === document);

  return { reviewed: legalSetStatus(review, inputs).reviewed, gaps: own ? legalTextGaps(own) : [] };
}

/** What search engines are told about a text: a draft is kept out of them and its links are not followed. */
export function legalRobots(reviewed: boolean): { index: boolean; follow: boolean } {
  return reviewed ? { index: true, follow: true } : { index: false, follow: false };
}

/** "Version du 1 novembre 2026" / "نسخة بتاريخ ...", or "Projet du ..." while the texts are a draft: the date of the text in the visitor's language, Tunisian time. A date that cannot be read is shown as it is. */
export function legalVersionText(locale: Locale, review: Readonly<LegalReview> = LEGAL_REVIEW, reviewed = false): string {
  const date = (isLegalDay(review.version) ? dayText(`${review.version}T12:00:00Z`, locale) : null) ?? review.version;

  return message(locale, reviewed ? 'legal.version' : 'legal.draftVersion', { date });
}

// ----------------------------------------------------------
// The consent line of the request form
// ----------------------------------------------------------

/**
 * The line is one sentence with two links in it, and the links fall in a different place in each language. The page gives the sentence two marks
 * in place of the link texts, and `consentParts` cuts the finished sentence at the marks, whatever order they come in. (A sentence with markup
 * would need `<` and `>`, which the catalogue keeps out of its texts.) The marks are two characters of the private-use area, which no text uses.
 */
export const CONSENT_TERMS_MARK = '\uE000';
export const CONSENT_PRIVACY_MARK = '\uE001';

export type ConsentPart = { kind: 'text'; text: string } | { kind: 'terms' } | { kind: 'privacy' };

export function consentParts(sentence: string): ConsentPart[] {
  const parts: ConsentPart[] = [];
  let rest = '';

  for (const char of sentence) {
    if (char === CONSENT_TERMS_MARK || char === CONSENT_PRIVACY_MARK) {
      if (rest !== '') parts.push({ kind: 'text', text: rest });

      parts.push({ kind: char === CONSENT_TERMS_MARK ? 'terms' : 'privacy' });
      rest = '';
    } else {
      rest += char;
    }
  }

  if (rest !== '') parts.push({ kind: 'text', text: rest });

  return parts;
}
