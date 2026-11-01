/**
 * The names of the trades (plumber, electrician, locksmith...): `label` is the person ("Plombier"), `service` the work ("Plomberie").
 * A test holds them equal to the table in generated/trades.ts, which is the server’s.
 */
export const trades = {
  label: {
    PLOMBIER: 'Plombier',
    MENUISIER: 'Menuisier',
    SERRURIER: 'Serrurier',
    ELECTRICIEN: 'Électricien',
    CHAUFFAGISTE: 'Chauffagiste',
    VITRIER: 'Vitrier',
    CLIMATICIEN: 'Climaticien',
    AUTRE: 'Autre',
  },
  service: {
    PLOMBIER: 'Plomberie',
    MENUISIER: 'Menuiserie',
    SERRURIER: 'Serrurerie',
    ELECTRICIEN: 'Électricité',
    CHAUFFAGISTE: 'Chauffage',
    VITRIER: 'Vitrerie',
    CLIMATICIEN: 'Climatisation',
    AUTRE: 'Autre',
  },
} as const;
