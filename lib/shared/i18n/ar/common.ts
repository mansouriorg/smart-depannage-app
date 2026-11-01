import type { SameShape } from '../types';
import type { common as frCommon } from '../fr/common';

/** Words every screen uses: buttons, loading, yes and no, the language switch (Arabic). */
export const common: SameShape<typeof frCommon> = {
  actions: {
    send: 'إرسال',
    cancel: 'إلغاء',
    close: 'إغلاق',
    back: 'رجوع',
    next: 'التالي',
    previous: 'السابق',
    continue: 'متابعة',
    retry: 'إعادة المحاولة',
    save: 'حفظ',
    edit: 'تعديل',
    delete: 'حذف',
    confirm: 'تأكيد',
    add: 'إضافة',
    remove: 'إزالة',
    copy: 'نسخ',
    copied: 'تم النسخ',
    search: 'بحث',
    refresh: 'تحديث',
    ok: 'حسنًا',
  },
  answers: {
    yes: 'نعم',
    no: 'لا',
  },
  states: {
    loading: 'جارٍ التحميل…',
    error: 'خطأ',
    thanks: 'شكرًا',
  },
  language: {
    label: 'اللغة',
    switch: 'تغيير اللغة',
  },
  characters: '{count, plural, one{حرف واحد} two{حرفين} few{{count} أحرف} many{{count} حرفًا} other{{count} حرف}}',
  photos: '{count, plural, =0{بلا صور} one{صورة واحدة} two{صورتين} few{{count} صور} many{{count} صورة} other{{count} صورة}}',
  dateAt: '{day} الساعة {time}',
  time: '{hour}:{minute}',
};
