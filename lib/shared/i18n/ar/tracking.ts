import type { SameShape } from '../types';
import type { tracking as frTracking } from '../fr/tracking';

/** The tracking page of a visitor: what each status says, and the five steps of the way (Arabic). */
export const tracking: SameShape<typeof frTracking> = {
  status: {
    CREATED: {
      title: 'تم استلام الطلب',
      message: 'استلمنا طلبك. سيقوم فريقنا بمراجعته.',
    },
    WAITING_ADMIN_REVIEW: {
      title: 'قيد المراجعة',
      message: 'يراجع فريقنا طلبك ويبحث عن الفنّي المناسب.',
    },
    QUOTE_SENT: {
      title: 'تم إعداد عرض السعر',
      message: 'تم إعداد عرض سعر لطلبك. سيتواصل معك فريقنا بشأنه.',
    },
    QUOTE_ACCEPTED: {
      title: 'تم قبول عرض السعر',
      message: 'تم قبول عرض السعر. نبحث عن الفنّي الذي سيتدخّل.',
    },
    ASSIGNED: {
      title: 'تم تعيين فنّي',
      message: 'تم تعيين فنّي لطلبك. ما زال عليه أن يؤكّد.',
    },
    ARTISAN_ACCEPTED: {
      title: 'تم تأكيد الفنّي',
      message: 'أكّد الفنّي تدخّله وهو يستعدّ للانطلاق.',
    },
    ARTISAN_ON_THE_WAY: {
      title: 'الفنّي في الطريق',
      message: 'فنّيك في الطريق إلى العنوان المحدّد.',
    },
    ARTISAN_ARRIVED: {
      title: 'الفنّي في المكان',
      message: 'وصل فنّيك إلى العنوان.',
    },
    IN_PROGRESS: {
      title: 'التدخّل قيد التنفيذ',
      message: 'يعمل الفنّي على حلّ مشكلتك.',
    },
    WAITING_CLIENT_VALIDATION: {
      title: 'انتهت الأشغال',
      message: 'أفاد الفنّي بأنه أنهى العمل. تحقّق من النتيجة، وإن وجدت مشكلة فأبلغ عنها أدناه.',
    },
    COMPLETED: {
      title: 'تم إنجاز التدخّل',
      message: 'شكرًا لاختيارك خدماتنا.',
    },
    PAYMENT_PENDING: {
      title: 'الدفع قيد الانتظار',
      message: 'انتهى التدخّل والدفع قيد الانتظار. سيتواصل معك فريقنا عند الحاجة.',
    },
    PAID: {
      title: 'تم تسجيل الدفع',
      message: 'تم تسجيل دفعتك. شكرًا.',
    },
    INVOICE_SENT: {
      title: 'تم إعداد الفاتورة',
      message: 'تم إعداد فاتورة تدخّلك.',
    },
    CANCELLED: {
      title: 'تم إلغاء الطلب',
      message: 'تم إلغاء هذا الطلب.',
    },
    DISPUTED: {
      title: 'نزاع قائم',
      message: 'هذا الطلب محلّ نزاع. سيتواصل معك فريقنا.',
    },
    unknown: {
      title: 'جارٍ التحديث',
      message: 'تعذّرت قراءة حالة طلبك. ستعيد الصفحة المحاولة بعد لحظات.',
    },
  },
  steps: {
    received: 'تم استلام الطلب',
    assigned: 'تم تعيين فنّي',
    onTheWay: 'في الطريق',
    intervention: 'التدخّل',
    done: 'تم الإنجاز',
  },
  notice: 'تحديث: {title}.',
};
