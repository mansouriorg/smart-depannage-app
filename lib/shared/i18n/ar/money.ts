import type { SameShape } from '../types';
import type { money as frMoney } from '../fr/money';

/** Amounts and what goes with them: the dinar, the tax, a price in a catalogue, a duration (Arabic). */
export const money: SameShape<typeof frMoney> = {
  unit: 'د.ت',
  withTax: '{amount} شامل للأداء',
  taxLabel: 'الأداء على القيمة المضافة {rate}%',
  price: {
    from: 'ابتداءً من {price}',
    onQuote: 'حسب عرض السعر',
  },
  duration: {
    minutes: '{minutes, plural, one{دقيقة} two{دقيقتان} few{{minutes} دقائق} many{{minutes} دقيقة} other{{minutes} دقيقة}}',
    hours: '{hours, plural, one{ساعة} two{ساعتان} few{{hours} ساعات} many{{hours} ساعة} other{{hours} ساعة}}',
    hoursMinutes: '{hours, plural, one{ساعة} two{ساعتان} few{{hours} ساعات} many{{hours} ساعة} other{{hours} ساعة}} و{minutes, plural, one{دقيقة} two{دقيقتان} few{{minutes} دقائق} many{{minutes} دقيقة} other{{minutes} دقيقة}}',
  },
};
