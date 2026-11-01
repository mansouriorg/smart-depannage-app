/** What a job’s status is called (the words of `STATUS_LABELS`). */
export const status = {
  labels: {
    CREATED: 'En attente',
    WAITING_ADMIN_REVIEW: 'En vérification',
    QUOTE_SENT: 'Devis envoyé',
    QUOTE_ACCEPTED: 'Devis accepté',
    ASSIGNED: 'Assigné',
    ARTISAN_ACCEPTED: 'Accepté',
    ARTISAN_ON_THE_WAY: 'En route',
    ARTISAN_ARRIVED: 'Arrivé',
    IN_PROGRESS: 'En cours',
    WAITING_CLIENT_VALIDATION: 'En attente de validation',
    COMPLETED: 'Terminé',
    PAYMENT_PENDING: 'Paiement en attente',
    PAID: 'Payé',
    INVOICE_SENT: 'Facture envoyée',
    CANCELLED: 'Annulé',
    DISPUTED: 'Litige',
  },
} as const;
