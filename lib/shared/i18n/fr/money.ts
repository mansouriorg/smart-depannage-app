/** Amounts and what goes with them: the dinar, the tax, a price in a catalogue, a duration. */
export const money = {
  unit: 'DT',
  withTax: '{amount} TTC',
  taxLabel: 'TVA {rate} %',
  price: {
    from: 'À partir de {price}',
    onQuote: 'Sur devis',
  },
  duration: {
    // French has one form, written as a plural with only `other` so that it has the same shape as the Arabic one (which has six).
    minutes: '{minutes, plural, other{{minutes} min}}',
    hours: '{hours, plural, other{{hours} h}}',
    hoursMinutes: '{hours, plural, other{{hours} h}} {minutes, plural, other{{minutes}}}',
  },
} as const;
