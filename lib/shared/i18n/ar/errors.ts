import type { SameShape } from '../types';
import type { errors as frErrors } from '../fr/errors';

/** Sentences for when the server gave none that a person can read (Arabic). */
export const errors: SameShape<typeof frErrors> = {
  generic: 'حدث خطأ. أعد المحاولة.',
  network: 'تعذّر الاتصال بالخادم. تحقّق من اتصالك ثم أعد المحاولة.',
  timeout: 'استغرق الخادم وقتًا طويلًا للرد. أعد المحاولة.',
  server: 'الخدمة غير متاحة مؤقتًا. أعد المحاولة بعد قليل.',
  tooManyAttempts: 'محاولات كثيرة جدًا من هذا الاتصال. أعد المحاولة بعد بضع دقائق.',
  botCheck: 'فشل التحقّق الأمني. أعد المحاولة: يجري الآن تحقّق جديد.',
  sessionExpired: 'انتهت جلستك. سجّل الدخول من جديد.',
};
