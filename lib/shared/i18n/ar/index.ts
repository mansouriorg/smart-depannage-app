import { common } from './common';
import { status } from './status';
import { errors } from './errors';
import { guest } from './guest';
import { tracking } from './tracking';
import { customer } from './customer';
import { quote } from './quote';
import { mission } from './mission';
import { cash } from './cash';
import { money } from './money';
import { reviews } from './reviews';
import { artisan } from './artisan';
import { push } from './push';
import { trades } from './trades';
import { website } from './website';
import { app } from './app';
import type { SameShape } from '../types';
import type { FR } from '../fr';

/** Every Arabic message, by namespace: the same keys as French. */
export const AR: SameShape<typeof FR> = {
  common,
  status,
  errors,
  guest,
  tracking,
  customer,
  quote,
  mission,
  cash,
  money,
  reviews,
  artisan,
  push,
  trades,
  website,
  app,
};
