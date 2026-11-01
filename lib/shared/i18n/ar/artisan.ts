import type { SameShape } from '../types';
import type { artisan as frArtisan } from '../fr/artisan';

/** What an artisan sees about themselves: the toggle that says whether they take jobs (Arabic). */
export const artisan: SameShape<typeof frArtisan> = {
  availability: {
    online: 'متصل',
    busy: 'مشغول',
    offline: 'غير متصل',
  },
};
