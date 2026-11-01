import { DEFAULT_LOCALE, INTL_TAGS, isRtl, localeOf, type Locale } from '../lib/shared/generated/i18n';

/**
 * The rules of the language of the app (P3-04), with no React and no native module in them, so that they can be run and tested
 * with plain `node`. The screens reach them through `services/i18n.tsx`.
 */

/** Where the language the technician chose is kept on the phone (expo-secure-store). */
export const LOCALE_STORAGE_KEY = 'app_locale';

/** The note that the server has not been told the language yet (expo-secure-store): it survives a restart of the app. */
export const LOCALE_PENDING_KEY = 'app_locale_pending';

/** The clock of Tunisia: the time a customer and a technician both read, whatever the phone is set to. */
export const TIME_ZONE = 'Africa/Tunis';

// ---------------------------------------------------------------------------------------------------------------------
// The language the app is in now, readable from anywhere (the axios interceptor, push, the alerts of a service)
// ---------------------------------------------------------------------------------------------------------------------

let current: Locale = DEFAULT_LOCALE;

/** The language the app shows at this moment. French until the provider has read the phone. */
export function currentLocale(): Locale {
  return current;
}

/** Only the provider calls this: it is what `X-App-Locale` and the alerts of the services read. */
export function setCurrentLocale(locale: Locale): void {
  current = locale;
}

// ---------------------------------------------------------------------------------------------------------------------
// Which language to start in
// ---------------------------------------------------------------------------------------------------------------------

/** The language of the phone ("ar-TN", "fr-FR", "en-US"...) as the JavaScript engine reports it, or null when it does not say. */
export function deviceLanguageTag(intl?: Pick<typeof Intl, 'DateTimeFormat'>): string | null {
  try {
    // Read inside the try: an engine without `Intl` must give "no language", not an error that stops the app from starting.
    return (intl ?? Intl).DateTimeFormat().resolvedOptions().locale || null;
  } catch {
    return null;
  }
}

/**
 * The language to start in. What the technician chose on this phone comes first; with nothing stored, the language of the
 * phone if the product speaks it (Arabic or French); else French. `chosen` is false until the technician (or the server, see
 * `afterSignIn`) has decided: the phone's language is only a first guess.
 */
export function startingLocale(stored: unknown, device: unknown): { locale: Locale; chosen: boolean } {
  const kept = localeOf(stored);

  if (kept) return { locale: kept, chosen: true };

  return { locale: localeOf(device) ?? DEFAULT_LOCALE, chosen: false };
}

/**
 * What to do with the language the server holds for the account that has just signed in.
 * The rule: a technician who has chosen a language on this phone keeps it, and the server is told (it writes the language of the
 * notifications). One who never chose here takes the server's Arabic, so that an account that chose Arabic looks the same on every phone.
 * The server's French is not taken: every account holds French until its owner chooses, so it says nothing about a choice, and a
 * technician whose phone is in Arabic must not be turned back to French at the sign-in. The phone's language is told instead.
 */
export function afterSignIn(state: { current: Locale; chosen: boolean; server: unknown }): { adopt: Locale | null; tell: Locale | null } {
  const server = localeOf(state.server);

  if (state.chosen) return { adopt: null, tell: server === state.current ? null : state.current };

  if (server === null || server === DEFAULT_LOCALE) return { adopt: null, tell: server === state.current ? null : state.current };

  return { adopt: server === state.current ? null : server, tell: null };
}

// ---------------------------------------------------------------------------------------------------------------------
// Telling the server the language
// ---------------------------------------------------------------------------------------------------------------------

export interface LocaleSyncDeps {
  /** Whether the phone holds the note "the server has not been told the language yet" (it survives a restart of the app). */
  loadPending(): Promise<boolean>;
  savePending(pending: boolean): Promise<void>;
  /** Whether an account is signed in on this phone: with none, nobody can be told (the next sign-in does it). */
  signedIn(): Promise<boolean>;
  /** Sends the language; throws when the server did not take it. */
  send(locale: Locale): Promise<void>;
  /** The language the app shows now. */
  current(): Locale;
}

export interface LocaleSync {
  /** Tells the server the language shown now. A failure is kept as a note, and tried again by `retry`. */
  tell(): Promise<void>;
  /** Tells the server again if an earlier telling did not get through. Cheap when none is waiting. */
  retry(): Promise<void>;
}

/**
 * The server writes the notifications of an account in the language it was told, and a technician stays signed in for weeks: a
 * telling that failed (no network) must be made again, and two choices in a row must reach the server in order. Tellings run one
 * after the other, and each one sends the language shown at the moment it runs, so the last choice is the last one told.
 */
export function createLocaleSync(deps: LocaleSyncDeps): LocaleSync {
  let chain: Promise<void> = Promise.resolve();

  async function run(): Promise<void> {
    if (!(await deps.signedIn())) return;

    const locale = deps.current();

    await deps.savePending(true);

    try {
      await deps.send(locale);
    } catch {
      return; // the note stays: the choice is on the phone and is told again
    }

    // A newer choice made while this one was on its way has its own telling queued behind this one.
    if (deps.current() === locale) await deps.savePending(false);
  }

  function enqueue(): Promise<void> {
    const next = chain.then(run, run);

    chain = next.catch(() => {});

    return next;
  }

  return {
    tell: enqueue,
    async retry() {
      if (await deps.loadPending().catch(() => false)) await enqueue();
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Direction
// ---------------------------------------------------------------------------------------------------------------------

/** The style of the root view: Yoga lays out rows, `start` and `end` and the alignment of text from it, at once, in this session. */
export function directionStyle(locale: Locale): { direction: 'ltr' | 'rtl' } {
  return { direction: isRtl(locale) ? 'rtl' : 'ltr' };
}

/**
 * What the native layer needs to follow a language. `forceRtl` is the direction to store with `I18nManager.forceRTL` (it applies at
 * the next launch); `restart` says whether the bars drawn by the system (the tab bar, the headers) are in the wrong direction until
 * then, which is when the technician is asked to close and reopen the app.
 */
export function nativeDirection(locale: Locale, nativeIsRtl: boolean): { forceRtl: boolean; restart: boolean } {
  const wanted = isRtl(locale);

  return { forceRtl: wanted, restart: wanted !== nativeIsRtl };
}

/** True when the switch from one language to the other turns the screen over (French to Arabic, or back). */
export function directionChanged(before: Locale, after: Locale): boolean {
  return isRtl(before) !== isRtl(after);
}

/** The style that turns an arrow or a chevron the other way in a right-to-left screen. */
export function mirrorStyle(locale: Locale): { transform: Array<{ scaleX: number }> } | undefined {
  return isRtl(locale) ? { transform: [{ scaleX: -1 }] } : undefined;
}

/**
 * The letters of an Arabic word are joined, and any space added between letters breaks the joins: a heading that is spaced out in
 * French (`letterSpacing`) must not be in Arabic.
 */
export function spacing(locale: Locale, value: number): number {
  return isRtl(locale) ? 0 : value;
}

// ---------------------------------------------------------------------------------------------------------------------
// Words and values that depend on the language
// ---------------------------------------------------------------------------------------------------------------------

/** A list of names in one line: "Tunis, Ariana" in French, "Tunis، Ariana" in Arabic. Empty items are left out. */
export function joinList(items: ReadonlyArray<string | null | undefined>, locale: Locale): string {
  return items.filter((item): item is string => Boolean(item)).join(locale === 'ar' ? '، ' : ', ');
}

/**
 * What both languages share: the digits are 0-9 (as in the amounts, the SMS and the shared helpers; a phone must not turn them into
 * Arabic-Indic digits) and the hours are on the 24-hour clock ("14:05"), unless the caller says otherwise.
 */
function withClock24(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions {
  const clock = options.hour !== undefined && options.hour12 === undefined && options.hourCycle === undefined;

  return { numberingSystem: 'latn', ...(clock ? { hourCycle: 'h23' as const } : {}), ...options };
}

/**
 * `Intl` options in the time of Tunis, the clock the customer and the technician read; a phone without time-zone data uses its own.
 * The regional data of Tunisia would otherwise give "02:05 PM" / "02:05 م" for the hours.
 */
export function inTunis(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions {
  return { timeZone: TIME_ZONE, ...withClock24(options) };
}

/** Arabic-Indic digits (٠ to ٩) written as 0 to 9: an engine that does not honour `numberingSystem: 'latn'` must not change the digits of a date. */
export function latinDigits(text: string): string {
  return text.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
}

/** Formats a date with `Intl`, in the tag of the language (fr-TN, ar-TN) and the time of Tunis; without time-zone data, on the phone's clock. */
export function formatDate(date: Date, locale: Locale, options: Intl.DateTimeFormatOptions): string {
  try {
    return latinDigits(new Intl.DateTimeFormat(INTL_TAGS[locale], inTunis(options)).format(date));
  } catch {
    return latinDigits(new Intl.DateTimeFormat(INTL_TAGS[locale], withClock24(options)).format(date));
  }
}
