// services/mockData.ts

export interface Mission {
  id: string;
  title: string;
  clientName: string;
  address: string;
  status: 'pending' | 'in_progress' | 'completed';
  date: string;
  description: string;
  price: number;
  lat?: number;
  lng?: number;
}

export const MOCK_MISSIONS: Mission[] = [
  {
    id: '1',
    title: 'Fuite d\'eau cuisine',
    clientName: 'Mme Ben Ali',
    address: '12 Rue de la République, Tunis',
    status: 'pending',
    date: '2026-02-12T10:00:00Z',
    description: 'Fuite importante sous l\'évier de la cuisine. Urgence modérée.',
    price: 80,
    lat: 36.8065,
    lng: 10.1815
  },
  {
    id: '2',
    title: 'Installation Chauffe-eau',
    clientName: 'Mr Tounsi',
    address: '5 Avenue Habib Bourguiba, Ariana',
    status: 'in_progress',
    date: '2026-02-12T14:30:00Z',
    description: 'Installation d\'un nouveau chauffe-eau à gaz de marque Junkers.',
    price: 150,
    lat: 36.8665,
    lng: 10.1647
  },
  {
    id: '3',
    title: 'Débouchage Canalisation',
    clientName: 'Café des Délices',
    address: 'Sidi Bou Said',
    status: 'completed',
    date: '2026-02-10T09:00:00Z',
    description: 'Canalisation principale bouchée, intervention avec furet électrique.',
    price: 200,
    lat: 36.8701,
    lng: 10.3418
  }
];