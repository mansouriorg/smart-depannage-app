import type { SameShape } from '../types';
import type { trades as frTrades } from '../fr/trades';

/** The names of the trades (plumber, electrician, locksmith...) (Arabic). */
export const trades: SameShape<typeof frTrades> = {
  label: {
    PLOMBIER: 'سبّاك',
    MENUISIER: 'نجّار',
    SERRURIER: 'فنّي أقفال',
    ELECTRICIEN: 'كهربائي',
    CHAUFFAGISTE: 'فنّي تدفئة',
    VITRIER: 'فنّي زجاج',
    CLIMATICIEN: 'فنّي تكييف',
    AUTRE: 'أخرى',
  },
  service: {
    PLOMBIER: 'السباكة',
    MENUISIER: 'النجارة',
    SERRURIER: 'الأقفال',
    ELECTRICIEN: 'الكهرباء',
    CHAUFFAGISTE: 'التدفئة',
    VITRIER: 'الزجاج',
    CLIMATICIEN: 'التكييف',
    AUTRE: 'أخرى',
  },
};
