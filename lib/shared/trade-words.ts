import { DEFAULT_LOCALE, type Locale } from './generated/i18n';
import { TRADE_LIST, isTradeCode, type TradeCode } from './generated/trades';
import { message } from './i18n';

/**
 * The names of the trades in a language (P3-04). `generated/trades.ts` is the server's table and holds the French ones (`label`: the
 * person, "Plombier"; `service`: the work, "Plomberie"); the catalogue (`trades.label.*`, `trades.service.*`) holds both languages, and a
 * test keeps its French equal to that table. What is stored and sent to the server stays the code or the French label: these words are
 * only for showing.
 */

/** The person: "Plombier" / "سبّاك". A text that is not a trade code comes back as it is. */
export function tradeLabel(code: string | null | undefined, locale: Locale = DEFAULT_LOCALE): string {
  return isTradeCode(code) ? message(locale, `trades.label.${code}`) : (code ?? '');
}

/** The work: "Plomberie" / "السباكة". A text that is not a trade code comes back as it is. */
export function tradeService(code: string | null | undefined, locale: Locale = DEFAULT_LOCALE): string {
  return isTradeCode(code) ? message(locale, `trades.service.${code}`) : (code ?? '');
}

/** The work of a service type as a person reads it, in the language: `serviceNameOf` of the server's table, for any language. */
export function serviceName(serviceType: string | null | undefined, locale: Locale = DEFAULT_LOCALE): string {
  return tradeService(serviceType, locale);
}

/** Every trade in the order a list shows them, with its words in the language. */
export function tradeOptions(locale: Locale = DEFAULT_LOCALE): Array<{ code: TradeCode; label: string; service: string }> {
  return TRADE_LIST.map((trade) => ({ code: trade.code, label: tradeLabel(trade.code, locale), service: tradeService(trade.code, locale) }));
}
