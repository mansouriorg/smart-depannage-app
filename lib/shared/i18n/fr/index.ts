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
import { legal } from './legal';
import { app } from './app';

/** Every French message, by namespace. French is what the product said before P3-04, word for word. */
export const FR = {
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
  legal,
  app,
} as const;
