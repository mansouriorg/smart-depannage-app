/**
 * The shape of a message catalogue (P3-04): a tree whose leaves are messages (see generated/i18n.ts for the syntax).
 *
 * `SameShape<typeof fr>` is the type of the Arabic catalogue: the same keys, each a string. A key that exists in French and not in
 * Arabic (or the other way round) does not compile, so a screen can never show a raw key because a translation was forgotten.
 */
export type Catalog = { readonly [key: string]: string | Catalog };

export type SameShape<T> = { [K in keyof T]: T[K] extends string ? string : SameShape<T[K]> };

/** "a.b.c" for every leaf of a catalogue. */
export type DotPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${DotPaths<T[K]>}`;
}[keyof T & string];
