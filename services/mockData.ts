export interface Mission {
  id: string;
  title: string;
  description: string;
  address: string;
  status: 'pending' | 'in_progress' | 'done';
  date: string;
}

export const MOCK_MISSIONS: Mission[] = [
  {
    id: '1',
    title: 'Fuite d\'eau Cuisine',
    description: 'The customer reported a leak under the sink. Bring spare pipes.',
    address: '12 Rue de Marseille, Tunis',
    status: 'pending',
    date: '2025-02-10',
  },
  {
    id: '2',
    title: 'Installation Prise Electrique',
    description: 'Install 3 new sockets in the living room.',
    address: '5 Av. Habib Bourguiba, Bizerte',
    status: 'in_progress',
    date: '2025-02-09',
  },
  {
    id: '3',
    title: 'Réparation Climatiseur',
    description: 'AC unit is making noise and not cooling.',
    address: 'Immeuble Saadi, Apt 4, Ariana',
    status: 'done',
    date: '2025-02-08',
  },
];