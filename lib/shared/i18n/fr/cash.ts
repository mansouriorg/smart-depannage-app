/**
 * The cash an artisan takes from a customer and the commission it brings to the platform.
 * {amount}, {cash}, {kept}, {due}, {remaining} are amounts with their unit; {mission} is the number of a mission ("#12").
 */
export const cash = {
  read: {
    empty: 'Entrez le montant reçu du client.',
    decimals: 'Un montant a au plus trois décimales (millimes).',
    tooBig: 'Ce montant est trop grand.',
    format: 'Montant invalide : écrivez par exemple {first} ou {second}.',
    zero: 'Le montant doit être supérieur à 0.',
    overRemaining: 'Le montant dépasse ce qu’il reste à payer ({remaining}).',
  },
  collected: {
    replayed: 'Cet encaissement de {amount} était déjà enregistré.',
    done: '{amount} encaissés.',
  },
  balance: {
    owes: 'Vous devez {amount} à la plateforme.',
    credit: 'La plateforme vous doit {amount}.',
    clear: 'Vous êtes à jour : rien à reverser à la plateforme.',
  },
  keeps: {
    none: 'Aucun encaissement pour le moment.',
    kept: 'Sur {cash} encaissés, vous gardez {kept}.',
    commissionOver: 'Sur {cash} encaissés, la commission due est de {due}, régularisations comprises.',
    commissionCorrected: 'Sur {cash} encaissés, la commission a été corrigée par l’équipe : voir l’historique.',
    onlyAdjustments: 'Ce solde vient de régularisations enregistrées par l’équipe : voir l’historique.',
    onlyCommissionFix: 'Votre commission a été corrigée par l’équipe : voir l’historique.',
    reversed: 'Des encaissements ont été annulés ou corrigés par l’équipe : voir l’historique.',
  },
  summary: {
    owed: 'À reverser à la plateforme',
    credit: 'La plateforme vous doit',
    clear: 'Vous êtes à jour',
  },
  entry: {
    collection: 'Encaissement',
    collectionMission: 'Encaissement – mission {mission}',
    remittance: 'Versement à la plateforme',
    reversal: 'Encaissement annulé',
    reversalMission: 'Encaissement annulé – mission {mission}',
    adjustment: 'Régularisation',
    adjustmentMission: 'Régularisation – mission {mission}',
    commission: 'Commission de {rate} %',
    reference: 'Réf. {reference}',
    cash: 'Espèces {amount}',
  },
} as const;
