/** Sentences for when the server gave none that a person can read: no network, a timeout, a server that is down. */
export const errors = {
  generic: 'Une erreur est survenue. Réessayez.',
  network: 'Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.',
  timeout: 'Le serveur met trop de temps à répondre. Réessayez.',
  server: 'Le service est momentanément indisponible. Réessayez dans un instant.',
  tooManyAttempts: 'Trop de tentatives depuis cette connexion. Réessayez dans quelques minutes.',
  botCheck: 'La vérification de sécurité a échoué. Réessayez : une nouvelle vérification est en cours.',
  sessionExpired: 'Votre session a expiré. Connectez-vous à nouveau.',
} as const;
