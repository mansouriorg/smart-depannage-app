import type { SameShape } from '../types';
import type { quote as frQuote } from '../fr/quote';

/** The quote an artisan makes on their phone: what the screen starts from, what it checks, where the mission stands (Arabic). */
export const quote: SameShape<typeof frQuote> = {
  draft: {
    title: 'عرض سعر – {work}',
    defaultWork: 'تدخّل',
  },
  hint: {
    onQuote: 'هذه الخدمة «حسب عرض السعر»: أدخل سعرك.',
    emergency: 'السعر في قائمة الأسعار للحالة الطارئة ({price}). عدّله عند الحاجة.',
    base: 'السعر في قائمة الأسعار ({price}). عدّله عند الحاجة.',
  },
  problems: {
    titleRequired: 'أدخل موضوع عرض السعر.',
    titleLong: 'الموضوع طويل جدًا ({max} على الأكثر).',
    descriptionLong: 'الوصف طويل جدًا ({max} على الأكثر).',
    taxRate: 'نسبة الأداء على القيمة المضافة غير صالحة: من 0 إلى 100%، بمنزلتين عشريتين على الأكثر.',
    validity: 'يجب أن تكون مدّة الصلاحية من 1 إلى 365 يومًا.',
    linesNone: 'أضف بندًا واحدًا على الأقل إلى عرض السعر.',
    linesTooMany: 'لا يمكن أن يحتوي عرض السعر على أكثر من {max, plural, one{بند واحد} two{بندين} few{{max} بنود} many{{max} بندًا} other{{max} بند}}.',
    labelRequired: 'اذكر ما يغطيه هذا البند.',
    labelLong: 'اسم البند طويل جدًا ({max} على الأكثر).',
    quantityEmpty: 'أدخل الكمّية.',
    quantityFormat: 'كمية غير صالحة: اكتب مثلًا {first} أو {second}.',
    quantityDecimals: 'للكمية منزلتان عشريتان على الأكثر.',
    quantityZero: 'يجب أن تكون الكمّية أكبر من 0.',
    quantityTooBig: 'يجب ألا تتجاوز الكمّية {max}.',
    priceEmpty: 'أدخل سعر الوحدة.',
    priceFormat: 'سعر غير صالح: اكتب مثلًا {first} أو {second}.',
    priceDecimals: 'للسعر ثلاث منازل عشرية على الأكثر (مليم).',
    priceTooBig: 'يجب ألا يتجاوز السعر {max}.',
    lineTooBig: 'يجب ألا يتجاوز مبلغ البند {max}.',
    totalZero: 'يجب أن يكون مجموع عرض السعر أكبر من 0.',
  },
  state: {
    accepted: 'قبل العميل عرض السعر.',
    expired: 'انتهت صلاحية عرض السعر المرسل: لم يعد بإمكان العميل قبوله.',
    expiredEditHint: 'عدّله لتمنحه مدّة صلاحية جديدة.',
    waiting: 'تم إرسال عرض السعر: لم يردّ العميل بعد.',
    changesOpen: 'يطلب العميل تعديل عرض السعر: عدّله وسيُعاد إرساله إلى العميل.',
    changesLocked: 'يطلب العميل تعديل عرض السعر، لكن لم يعد بإمكانك تعديله في هذه المرحلة من المهمّة: تواصل مع الإدارة.',
    lastRejected: 'رفض العميل آخر عرض سعر.',
    lastExpired: 'انتهت صلاحية آخر عرض سعر.',
    lastCancelled: 'تم إلغاء آخر عرض سعر.',
    none: 'لم يتم إرسال أي عرض سعر لهذه المهمّة.',
  },
  block: {
    acceptedLocked: 'قبل العميل عرض السعر هذا: لم يعد من الممكن تعديله.',
    gone: 'عرض السعر هذا لم يعد موجودًا.',
    locked: 'لم يعد من الممكن تعديل عرض السعر هذا.',
    alreadyAccepted: 'قبل العميل بالفعل عرض سعر لهذه المهمّة.',
    alreadyOut: 'يوجد بالفعل عرض سعر قائم لهذه المهمّة: عدّله من صفحة المهمّة.',
    window: 'يمكن إعداد عرض السعر بين قبول المهمّة وانتهاء الأشغال.',
  },
};
