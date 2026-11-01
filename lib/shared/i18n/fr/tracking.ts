/** The tracking page of a visitor: what each status says, and the five steps of the way. */
export const tracking = {
  status: {
    CREATED: {
      title: 'Demande reçue',
      message: 'Nous avons bien reçu votre demande. Notre équipe va l’examiner.',
    },
    WAITING_ADMIN_REVIEW: {
      title: 'Vérification en cours',
      message: 'Notre équipe vérifie votre demande et cherche le technicien qui conviendra.',
    },
    QUOTE_SENT: {
      title: 'Devis établi',
      message: 'Un devis a été établi pour votre demande. Notre équipe vous contactera à ce sujet.',
    },
    QUOTE_ACCEPTED: {
      title: 'Devis accepté',
      message: 'Votre devis est accepté. Nous cherchons le technicien qui interviendra.',
    },
    ASSIGNED: {
      title: 'Technicien désigné',
      message: 'Un technicien a été désigné pour votre demande. Il doit encore confirmer.',
    },
    ARTISAN_ACCEPTED: {
      title: 'Technicien confirmé',
      message: 'Votre technicien a confirmé l’intervention et se prépare à partir.',
    },
    ARTISAN_ON_THE_WAY: {
      title: 'Technicien en route',
      message: 'Votre technicien est en route vers l’adresse indiquée.',
    },
    ARTISAN_ARRIVED: {
      title: 'Technicien sur place',
      message: 'Votre technicien est arrivé à l’adresse.',
    },
    IN_PROGRESS: {
      title: 'Intervention en cours',
      message: 'Le technicien travaille sur votre problème.',
    },
    WAITING_CLIENT_VALIDATION: {
      title: 'Travaux terminés',
      message: 'Le technicien indique avoir terminé. Vérifiez le résultat : en cas de souci, signalez-le ci-dessous.',
    },
    COMPLETED: {
      title: 'Intervention terminée',
      message: 'Merci d’avoir fait appel à nous.',
    },
    PAYMENT_PENDING: {
      title: 'Paiement en attente',
      message: 'L’intervention est terminée et le paiement est en attente. Notre équipe vous contactera si besoin.',
    },
    PAID: {
      title: 'Paiement enregistré',
      message: 'Votre paiement est enregistré. Merci.',
    },
    INVOICE_SENT: {
      title: 'Facture établie',
      message: 'La facture de votre intervention a été établie.',
    },
    CANCELLED: {
      title: 'Demande annulée',
      message: 'Cette demande a été annulée.',
    },
    DISPUTED: {
      title: 'Litige en cours',
      message: 'Cette demande fait l’objet d’un litige. Notre équipe vous contactera.',
    },
    // A status this copy does not know: never its raw code, which would mean nothing to a customer.
    unknown: {
      title: 'Mise à jour en cours',
      message: 'Nous n’avons pas pu lire l’état de votre demande. La page réessaiera dans un instant.',
    },
  },
  steps: {
    received: 'Demande reçue',
    assigned: 'Technicien désigné',
    onTheWay: 'En route',
    intervention: 'Intervention',
    done: 'Terminée',
  },
  // When the technician will be there (P3-05), told while the job is on the way. Never worked out from a position that is old.
  arrival: {
    title: 'Arrivée estimée',
    soon: 'Votre technicien arrive dans un instant.',
    minutes: '{minutes, plural, one{Votre technicien arrive dans environ {minutes} minute.} other{Votre technicien arrive dans environ {minutes} minutes.}}',
    far: 'Votre technicien arrive dans plus d’une heure.',
    stale: 'Nous n’avons pas de position récente de votre technicien. L’heure d’arrivée reviendra dès que sa position sera mise à jour.',
    unknown: 'La position de votre technicien n’est pas encore connue. L’heure d’arrivée apparaîtra dès qu’elle le sera.',
    note: 'Estimation selon la distance et une vitesse moyenne : la circulation peut la changer.',
    age: '{minutes, plural, other{Position reçue il y a {minutes} min}}',
    justNow: 'Position reçue à l’instant',
  },
  // What a screen reader announces when the status changes.
  notice: 'Mise à jour : {title}.',
} as const;
