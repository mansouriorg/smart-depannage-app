/** The steps of a mission as the artisan does them, the reasons for a refusal, and the piles missions are sorted in. */
export const mission = {
  flow: {
    accept: { label: 'Accepter la mission', busy: 'Acceptation…' },
    onTheWay: { label: 'Je suis en route', busy: 'Envoi…' },
    arrived: { label: 'Je suis arrivé', busy: 'Envoi…' },
    start: { label: 'Commencer les travaux', busy: 'Démarrage…' },
    complete: { label: 'Terminer avec une photo', busy: 'Envoi de la photo…' },
  },
  refusal: {
    refuse: { label: 'Refuser la mission', question: 'Pourquoi refusez-vous cette mission ?' },
    giveBack: { label: 'Rendre la mission', question: 'Pourquoi rendez-vous cette mission ?' },
  },
  decline: {
    NOT_AVAILABLE: 'Je ne suis pas disponible',
    TOO_FAR: 'C’est trop loin',
    OUT_OF_SPECIALTY: 'Ce n’est pas ma spécialité',
    PRICE_TOO_LOW: 'Le prix est trop bas',
    OTHER: 'Autre raison',
  },
  milestones: {
    assigned: 'Mission assignée',
    accept: 'Mission acceptée',
    onTheWay: 'En route vers le client',
    arrived: 'Arrivé chez le client',
    start: 'Travaux commencés',
    complete: 'Travaux terminés',
  },
  buckets: {
    todo: 'À accepter',
    active: 'En cours',
    done: 'Terminées',
  },
} as const;
