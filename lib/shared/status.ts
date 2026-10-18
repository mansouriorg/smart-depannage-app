import { CANONICAL_STATUSES, CanonicalStatus, STATUS_GROUPS, StatusGroup, canonicalStatus } from './generated/intervention-status';

/**
 * What a job's status is called, and how it looks, in every app.
 *
 * The status table comes from the server (generated/intervention-status.ts). The two tables below
 * are typed `Record<CanonicalStatus, …>`: when the server adds a status and the generated copy is
 * updated, this file stops compiling until the new status has its words and its tone, so no app
 * shows a raw code for a status that exists.
 */

/** How a status reads: the colour family an app gives it. */
export type StatusTone = 'waiting' | 'info' | 'active' | 'success' | 'warning' | 'danger';

export const STATUS_LABELS: Record<CanonicalStatus, string> = {
  CREATED: 'En attente',
  WAITING_ADMIN_REVIEW: 'En vérification',
  QUOTE_SENT: 'Devis envoyé',
  QUOTE_ACCEPTED: 'Devis accepté',
  ASSIGNED: 'Assigné',
  ARTISAN_ACCEPTED: 'Accepté',
  ARTISAN_ON_THE_WAY: 'En route',
  ARTISAN_ARRIVED: 'Arrivé',
  IN_PROGRESS: 'En cours',
  WAITING_CLIENT_VALIDATION: 'En attente de validation',
  COMPLETED: 'Terminé',
  PAYMENT_PENDING: 'Paiement en attente',
  PAID: 'Payé',
  INVOICE_SENT: 'Facture envoyée',
  CANCELLED: 'Annulé',
  DISPUTED: 'Litige',
};

export const STATUS_TONES: Record<CanonicalStatus, StatusTone> = {
  CREATED: 'waiting',
  WAITING_ADMIN_REVIEW: 'waiting',
  QUOTE_SENT: 'waiting',
  QUOTE_ACCEPTED: 'waiting',
  ASSIGNED: 'info',
  ARTISAN_ACCEPTED: 'info',
  ARTISAN_ON_THE_WAY: 'active',
  ARTISAN_ARRIVED: 'active',
  IN_PROGRESS: 'active',
  WAITING_CLIENT_VALIDATION: 'warning',
  COMPLETED: 'success',
  PAYMENT_PENDING: 'warning',
  PAID: 'success',
  INVOICE_SENT: 'success',
  CANCELLED: 'danger',
  DISPUTED: 'danger',
};

/**
 * The words for a status, whichever spelling the server stored it with (PENDING and CREATED are the
 * same status). A status nobody knows is shown as it came, or as `fallback` when there is none.
 */
export function statusLabel(status: string | null | undefined, fallback = ''): string {
  const canonical = canonicalStatus(status);

  if (canonical) return STATUS_LABELS[canonical];

  return status ? String(status) : fallback;
}

/** The tone of a status; a status nobody knows has none (an app shows it in grey). */
export function statusTone(status: string | null | undefined): StatusTone | null {
  const canonical = canonicalStatus(status);

  return canonical ? STATUS_TONES[canonical] : null;
}

/** waiting / active / completed / cancelled / disputed: the group a status belongs to, for lists and counters. */
export function statusGroupOf(status: string | null | undefined): StatusGroup | null {
  const canonical = canonicalStatus(status);

  if (!canonical) return null;

  const groups = Object.keys(STATUS_GROUPS) as StatusGroup[];

  return groups.find((group) => (STATUS_GROUPS[group] as readonly string[]).includes(canonical)) ?? null;
}

/**
 * The dashboard speaks a few statuses of its own (PENDING, ASSIGNED, ACCEPTED, IN_PROGRESS,
 * COMPLETED, CANCELLED). The server writes "the artisan accepted" as ARTISAN_ACCEPTED: the
 * dashboard's "Affecté" (ACCEPTED). The rest goes through unchanged.
 */
export function dashboardStatus(status: string | null | undefined): string {
  return status === 'ARTISAN_ACCEPTED' ? 'ACCEPTED' : (status ?? '');
}

/** Every status with its words, in the order of the job's life: for a filter or a <select>. */
export function statusOptions(): Array<{ value: CanonicalStatus; label: string }> {
  return CANONICAL_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }));
}
