import type { SameShape } from '../types';
import type { status as frStatus } from '../fr/status';

/** What a job’s status is called (Arabic). */
export const status: SameShape<typeof frStatus> = {
  labels: {
    CREATED: 'قيد الانتظار',
    WAITING_ADMIN_REVIEW: 'قيد المراجعة',
    QUOTE_SENT: 'تم إرسال عرض السعر',
    QUOTE_ACCEPTED: 'تم قبول عرض السعر',
    ASSIGNED: 'تم التعيين',
    ARTISAN_ACCEPTED: 'مقبول',
    ARTISAN_ON_THE_WAY: 'في الطريق',
    ARTISAN_ARRIVED: 'وصل',
    IN_PROGRESS: 'قيد التنفيذ',
    WAITING_CLIENT_VALIDATION: 'في انتظار التأكيد',
    COMPLETED: 'تم الإنجاز',
    PAYMENT_PENDING: 'الدفع قيد الانتظار',
    PAID: 'مدفوع',
    INVOICE_SENT: 'تم إرسال الفاتورة',
    CANCELLED: 'ملغى',
    DISPUTED: 'نزاع',
  },
};
