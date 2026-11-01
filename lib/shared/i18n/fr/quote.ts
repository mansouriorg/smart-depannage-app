/**
 * The quote an artisan makes on their phone: what the screen starts from, what it checks before it sends, where the mission stands.
 * {max} is a number, an amount with its unit, or a phrase with its noun ("120 caractères", from common.characters).
 */
export const quote = {
  draft: {
    title: 'Devis – {work}',
    defaultWork: 'Intervention',
  },
  hint: {
    onQuote: 'Ce service est « sur devis » : indiquez votre prix.',
    emergency: 'Prix du catalogue pour une urgence ({price}). Ajustez-le si besoin.',
    base: 'Prix du catalogue ({price}). Ajustez-le si besoin.',
  },
  problems: {
    titleRequired: 'Donnez un titre au devis.',
    titleLong: 'Le titre est trop long ({max} au plus).',
    descriptionLong: 'La description est trop longue ({max} au plus).',
    taxRate: 'Taux de TVA invalide : de 0 à 100 %, avec au plus deux décimales.',
    validity: 'La durée de validité doit être de 1 à 365 jours.',
    linesNone: 'Ajoutez au moins une ligne au devis.',
    linesTooMany: 'Un devis ne peut pas avoir plus de {max, plural, one{{max} ligne} other{{max} lignes}}.',
    labelRequired: 'Indiquez ce que couvre cette ligne.',
    labelLong: 'Le libellé est trop long ({max} au plus).',
    quantityEmpty: 'Indiquez la quantité.',
    quantityFormat: 'Quantité invalide : écrivez par exemple {first} ou {second}.',
    quantityDecimals: 'Une quantité a au plus deux décimales.',
    quantityZero: 'La quantité doit être supérieure à 0.',
    quantityTooBig: 'La quantité ne peut pas dépasser {max}.',
    priceEmpty: 'Indiquez le prix unitaire.',
    priceFormat: 'Prix invalide : écrivez par exemple {first} ou {second}.',
    priceDecimals: 'Un prix a au plus trois décimales (millimes).',
    priceTooBig: 'Le prix ne peut pas dépasser {max}.',
    lineTooBig: 'Une ligne ne peut pas dépasser {max}.',
    totalZero: 'Le total du devis doit être supérieur à 0.',
  },
  state: {
    accepted: 'Devis accepté par le client.',
    expired: 'Le devis envoyé est arrivé à échéance : le client ne peut plus l’accepter.',
    expiredEditHint: 'Modifiez-le pour lui donner une nouvelle durée de validité.',
    waiting: 'Devis envoyé : le client n’a pas encore répondu.',
    changesOpen: 'Le client demande une modification du devis : changez-le, il sera renvoyé au client.',
    changesLocked: 'Le client demande une modification du devis, mais vous ne pouvez plus le modifier à ce stade de la mission : contactez l’administration.',
    lastRejected: 'Le dernier devis a été refusé par le client.',
    lastExpired: 'Le dernier devis a expiré.',
    lastCancelled: 'Le dernier devis a été annulé.',
    none: 'Aucun devis envoyé pour cette mission.',
  },
  block: {
    acceptedLocked: 'Ce devis a été accepté par le client : il ne peut plus être modifié.',
    gone: 'Ce devis n’existe plus.',
    locked: 'Ce devis ne peut plus être modifié.',
    alreadyAccepted: 'Le client a déjà accepté un devis pour cette mission.',
    alreadyOut: 'Un devis est déjà en cours pour cette mission : modifiez-le depuis la mission.',
    window: 'Un devis peut être établi entre l’acceptation de la mission et la fin des travaux.',
  },
} as const;
