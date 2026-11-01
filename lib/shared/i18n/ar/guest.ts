import type { SameShape } from '../types';
import type { guest as frGuest } from '../fr/guest';

/** The request a visitor makes without an account: what is wrong in the form, and in a picture (Arabic). */
export const guest: SameShape<typeof frGuest> = {
  problems: {
    serviceType: 'اختر نوع المشكلة.',
    descriptionShort: 'اكتب وصفًا للمشكلة لا يقل عن {min}.',
    descriptionLong: 'يجب ألا يتجاوز الوصف {max}.',
    photoRequired: 'تتطلب هذه الخدمة صورة واحدة على الأقل للمشكلة.',
    addressShort: 'أدخل العنوان الكامل لمكان التدخّل.',
    addressLong: 'يجب ألا يتجاوز العنوان {max}.',
    accessLong: 'يجب ألا تتجاوز تفاصيل الوصول {max}.',
    positionIncomplete: 'الموقع غير مكتمل. استخدمه من جديد أو أزله.',
    positionInvalid: 'الموقع غير صالح. استخدمه من جديد أو أزله.',
    nameRequired: 'اسمك مطلوب.',
    nameLong: 'يجب ألا يتجاوز الاسم {max}.',
    phoneRequired: 'رقم هاتفك مطلوب.',
    phoneInvalid: 'رقم غير صالح. مثال: {example}.',
    emailInvalid: 'البريد الإلكتروني غير صالح.',
    ratingRequired: 'اختر تقييمًا من 1 إلى 5.',
    commentLong: 'يجب ألا يتجاوز التعليق {max}.',
    reportShort: 'اكتب وصفًا للمشكلة لا يقل عن {min}.',
    reportLong: 'يجب ألا يتجاوز النص {max}.',
  },
  photos: {
    badType: '{name}: الصيغ المقبولة فقط هي {jpeg} و{png} و{webp}.',
    empty: '{name}: الملف فارغ.',
    tooBig: '{name}: حجم الصورة يتجاوز {megabytes} ميغابايت.',
    tooMany: '{name}: يمكنك إرفاق {max} على الأكثر.',
  },
};
