/** Words every screen uses: buttons, loading, yes and no, the language switch. */
export const common = {
  actions: {
    send: 'Envoyer',
    cancel: 'Annuler',
    close: 'Fermer',
    back: 'Retour',
    next: 'Suivant',
    previous: 'Précédent',
    continue: 'Continuer',
    retry: 'Réessayer',
    save: 'Enregistrer',
    edit: 'Modifier',
    delete: 'Supprimer',
    confirm: 'Confirmer',
    add: 'Ajouter',
    remove: 'Retirer',
    copy: 'Copier',
    copied: 'Copié',
    search: 'Rechercher',
    refresh: 'Actualiser',
    ok: 'OK',
  },
  answers: {
    yes: 'Oui',
    no: 'Non',
  },
  states: {
    loading: 'Chargement…',
    error: 'Erreur',
    thanks: 'Merci',
  },
  language: {
    label: 'Langue',
    switch: 'Changer de langue',
  },
  // A count with its noun, for the limits written inside a sentence ("500 caractères"): the sentence takes the whole phrase as {max} or {min}.
  characters: '{count, plural, one{{count} caractère} other{{count} caractères}}',
  photos: '{count, plural, =0{aucune photo} one{{count} photo} other{{count} photos}}',
  // A day and an hour together ("24 octobre 2026 à 14 h 05"), and the hour as people write it.
  dateAt: '{day} à {time}',
  time: '{hour} h {minute}',
} as const;
