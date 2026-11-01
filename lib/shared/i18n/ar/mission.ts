import type { SameShape } from '../types';
import type { mission as frMission } from '../fr/mission';

/** The steps of a mission as the artisan does them, the reasons for a refusal, and the piles missions are sorted in (Arabic). */
export const mission: SameShape<typeof frMission> = {
  flow: {
    accept: { label: 'قبول المهمّة', busy: 'جارٍ القبول…' },
    onTheWay: { label: 'أنا في الطريق', busy: 'جارٍ الإرسال…' },
    arrived: { label: 'وصلت', busy: 'جارٍ الإرسال…' },
    start: { label: 'بدء الأشغال', busy: 'جارٍ البدء…' },
    complete: { label: 'إنهاء الأشغال بصورة', busy: 'جارٍ إرسال الصورة…' },
  },
  refusal: {
    refuse: { label: 'رفض المهمّة', question: 'لماذا ترفض هذه المهمّة؟' },
    giveBack: { label: 'إعادة المهمّة', question: 'لماذا تعيد هذه المهمّة؟' },
  },
  decline: {
    NOT_AVAILABLE: 'لست متاحًا',
    TOO_FAR: 'المكان بعيد جدًا',
    OUT_OF_SPECIALTY: 'هذا ليس من تخصّصي',
    PRICE_TOO_LOW: 'السعر منخفض جدًا',
    OTHER: 'سبب آخر',
  },
  milestones: {
    assigned: 'تم تعيين المهمّة',
    accept: 'تم قبول المهمّة',
    onTheWay: 'في الطريق إلى العميل',
    arrived: 'وصل إلى مكان العميل',
    start: 'بدأت الأشغال',
    complete: 'انتهت الأشغال',
  },
  buckets: {
    todo: 'للقبول',
    active: 'قيد التنفيذ',
    done: 'المنجزة',
  },
};
