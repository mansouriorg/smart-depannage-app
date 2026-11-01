import { DEFAULT_LOCALE, Locale, MessageParams, formatMessage } from '../generated/i18n';

import { AR } from './ar';
import { FR } from './fr';
import type { Catalog, DotPaths } from './types';

/**
 * The messages of the product in both languages (P3-04), read by the website (next-intl takes `catalogOf(locale)` as its messages),
 * by the phone app (`translator(locale)`) and by the shared rules that return a sentence (they take a `locale`).
 *
 * French is the source: it is what the product said before, word for word, and a key is added there first.
 */
export type MessageKey = DotPaths<typeof FR>;

const CATALOGS: Record<Locale, Catalog> = { fr: FR, ar: AR };

/** The whole tree of one language, for a library that reads nested messages (next-intl). */
export function catalogOf(locale: Locale): Catalog {
  return CATALOGS[locale];
}

function find(catalog: Catalog, key: string): string | null {
  let node: string | Catalog | undefined = catalog;

  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string') return null;

    node = node[part];
  }

  return typeof node === 'string' ? node : null;
}

/** The raw text of a message in a language (French when Arabic lacks it at run time), or null when no language has it. */
export function messageText(locale: Locale, key: string): string | null {
  return messageTextIn(CATALOGS, locale, key);
}

/** `messageText` over catalogues given by the caller: the tests use it to see the French fallback that real catalogues never need. */
export function messageTextIn(catalogs: Record<Locale, Catalog>, locale: Locale, key: string): string | null {
  return find(catalogs[locale], key) ?? find(catalogs[DEFAULT_LOCALE], key);
}

/**
 * A message with its values in. A key nobody has is shown as the key itself, never as nothing: it is seen and reported, and the
 * catalogue tests make sure it cannot happen with a typed key.
 */
export function message(locale: Locale, key: MessageKey, params?: MessageParams): string {
  const text = messageText(locale, key);

  return text === null ? key : formatMessage(locale, text, params);
}

export type Translate = (key: MessageKey, params?: MessageParams) => string;

export function translator(locale: Locale): Translate {
  return (key, params) => message(locale, key, params);
}

/** Every key of a catalogue with its text, for the tests and for a tool that lists the messages. */
export function flatten(catalog: Catalog, prefix = ''): Array<[string, string]> {
  const rows: Array<[string, string]> = [];

  for (const [name, value] of Object.entries(catalog)) {
    const path = prefix ? `${prefix}.${name}` : name;

    if (typeof value === 'string') rows.push([path, value]);
    else rows.push(...flatten(value, path));
  }

  return rows;
}
