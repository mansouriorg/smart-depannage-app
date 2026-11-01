/**
 * The request a visitor makes without an account: what is wrong in the form, and in a picture. A limit written in a sentence
 * ({min}, {max}) arrives as a phrase with its noun ("10 caractères", from common.characters), so each language agrees it its own way.
 */
export const guest = {
  problems: {
    serviceType: 'Choisissez le type de problème.',
    descriptionShort: 'Décrivez le problème en au moins {min}.',
    descriptionLong: 'La description ne peut pas dépasser {max}.',
    photoRequired: 'Ce service demande au moins une photo du problème.',
    addressShort: 'Indiquez l’adresse complète de l’intervention.',
    addressLong: 'L’adresse ne peut pas dépasser {max}.',
    accessLong: 'Les précisions d’accès ne peuvent pas dépasser {max}.',
    positionIncomplete: 'La position est incomplète. Utilisez-la à nouveau ou retirez-la.',
    positionInvalid: 'La position n’est pas valable. Utilisez-la à nouveau ou retirez-la.',
    nameRequired: 'Votre nom est requis.',
    nameLong: 'Le nom ne peut pas dépasser {max}.',
    phoneRequired: 'Votre numéro de téléphone est requis.',
    phoneInvalid: 'Numéro invalide. Exemple : {example}.',
    emailInvalid: 'Adresse e-mail invalide.',
    ratingRequired: 'Choisissez une note de 1 à 5.',
    commentLong: 'Le commentaire ne peut pas dépasser {max}.',
    reportShort: 'Décrivez le problème en au moins {min}.',
    reportLong: 'Le texte ne peut pas dépasser {max}.',
  },
  photos: {
    badType: '{name} : seules les images {jpeg}, {png} ou {webp} sont acceptées.',
    empty: '{name} : le fichier est vide.',
    tooBig: '{name} : l’image dépasse {megabytes} Mo.',
    tooMany: '{name} : vous pouvez joindre {max} au maximum.',
  },
} as const;
