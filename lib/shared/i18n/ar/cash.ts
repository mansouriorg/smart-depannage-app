import type { SameShape } from '../types';
import type { cash as frCash } from '../fr/cash';

/** The cash an artisan takes from a customer and the commission it brings to the platform (Arabic). */
export const cash: SameShape<typeof frCash> = {
  read: {
    empty: 'أدخل المبلغ الذي استلمته من العميل.',
    decimals: 'للمبلغ ثلاث منازل عشرية على الأكثر (مليم).',
    tooBig: 'هذا المبلغ كبير جدًا.',
    format: 'مبلغ غير صالح: اكتب مثلًا {first} أو {second}.',
    zero: 'يجب أن يكون المبلغ أكبر من 0.',
    overRemaining: 'المبلغ يتجاوز المتبقي للدفع ({remaining}).',
  },
  collected: {
    replayed: 'تم تسجيل هذا التحصيل بقيمة {amount} من قبل.',
    done: 'تم تحصيل {amount}.',
  },
  balance: {
    owes: 'عليك دفع {amount} إلى المنصّة.',
    credit: 'المنصّة مدينة لك بمبلغ {amount}.',
    clear: 'رصيدك مسوّى: لا شيء لتدفعه إلى المنصّة.',
  },
  keeps: {
    none: 'لا يوجد أي تحصيل حتى الآن.',
    kept: 'من {cash} تم تحصيلها، تحتفظ بمبلغ {kept}.',
    commissionOver: 'من {cash} تم تحصيلها، العمولة المستحقّة {due} بما فيها التسويات.',
    commissionCorrected: 'من {cash} تم تحصيلها، صحّح الفريق العمولة: راجع السجلّ.',
    onlyAdjustments: 'يأتي هذا الرصيد من تسويات سجّلها الفريق: راجع السجلّ.',
    onlyCommissionFix: 'صحّح الفريق عمولتك: راجع السجلّ.',
    reversed: 'ألغى الفريق بعض المبالغ المحصّلة أو صحّحها: راجع السجلّ.',
  },
  summary: {
    owed: 'للدفع إلى المنصّة',
    credit: 'المنصّة مدينة لك',
    clear: 'رصيدك مسوّى',
  },
  entry: {
    collection: 'تحصيل',
    collectionMission: 'تحصيل – مهمّة {mission}',
    remittance: 'دفعة إلى المنصّة',
    reversal: 'تحصيل ملغى',
    reversalMission: 'تحصيل ملغى – مهمّة {mission}',
    adjustment: 'تسوية',
    adjustmentMission: 'تسوية – مهمّة {mission}',
    commission: 'عمولة {rate}%',
    reference: 'المرجع {reference}',
    cash: 'نقدًا {amount}',
  },
};
