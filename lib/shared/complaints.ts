import { amountOf, moneyText } from './customer';
import { readAmount } from './money';
import type { StatusTone } from './status';

/**
 * The complaints screens of the back office (P2-09): the words, the views, what the server answers, and the checks of the forms.
 * The server side is `smart-depannage-serveur` (src/modules/admin/complaint-queue.ts and complaint-center.ts). Written by hand,
 * like `finance.ts`.
 *
 * A customer opens a complaint on a job; the team looks at it, answers, and closes it. When the customer asked for money back,
 * somebody decides: the decision is "accepted" at once, and the money goes back later, as a refund of a payment of the job. Until
 * then the server's status already reads REFUNDED, so the screens never print that word on its own (`complaintStatusWords`).
 */

// ----------------------------------------------------------
// The views and the words
// ----------------------------------------------------------

export const COMPLAINT_VIEWS = ['todo', 'decide', 'pay', 'unassigned', 'closed', 'all'] as const;
export type ComplaintView = (typeof COMPLAINT_VIEWS)[number];

export const COMPLAINT_VIEW_LABELS: Record<ComplaintView, string> = {
  todo: 'À traiter',
  decide: 'Remboursement à décider',
  pay: 'Remboursement à verser',
  unassigned: 'Sans responsable',
  closed: 'Clôturées',
  all: 'Toutes',
};

/** What each view is for, in a line (under the tab, and as its hint). */
export const COMPLAINT_VIEW_HINTS: Record<ComplaintView, string> = {
  todo: 'Nouvelles, en cours, ou en attente d’une réponse du client ou de l’artisan.',
  decide: 'Le client demande un remboursement et personne n’a encore décidé.',
  pay: 'Le remboursement est accepté : l’argent n’est pas encore revenu au client.',
  unassigned: 'Ouvertes, et que personne ne traite.',
  closed: 'Résolues, rejetées ou remboursées.',
  all: 'Toutes les réclamations.',
};

export const COMPLAINT_SORTS = ['oldest', 'newest'] as const;
export type ComplaintSort = (typeof COMPLAINT_SORTS)[number];

export const COMPLAINT_SORT_LABELS: Record<ComplaintSort, string> = {
  oldest: 'Les plus anciennes d’abord',
  newest: 'Les plus récentes d’abord',
};

export const COMPLAINT_STATUSES = ['OPEN', 'IN_REVIEW', 'WAITING_CLIENT', 'WAITING_ARTISAN', 'RESOLVED', 'REJECTED', 'REFUNDED'] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  OPEN: 'Nouvelle',
  IN_REVIEW: 'En cours',
  WAITING_CLIENT: 'Attente du client',
  WAITING_ARTISAN: 'Attente du technicien',
  RESOLVED: 'Résolue',
  REJECTED: 'Rejetée',
  REFUNDED: 'Remboursée',
};

const STATUS_TONES: Record<ComplaintStatus, StatusTone> = {
  OPEN: 'warning',
  IN_REVIEW: 'info',
  WAITING_CLIENT: 'waiting',
  WAITING_ARTISAN: 'waiting',
  RESOLVED: 'success',
  REJECTED: 'danger',
  REFUNDED: 'success',
};

export const OPEN_COMPLAINT_STATUSES: readonly ComplaintStatus[] = ['OPEN', 'IN_REVIEW', 'WAITING_CLIENT', 'WAITING_ARTISAN'];
export const CLOSED_COMPLAINT_STATUSES: readonly ComplaintStatus[] = ['RESOLVED', 'REJECTED', 'REFUNDED'];

export const REFUND_DECISIONS = ['NOT_REQUESTED', 'PENDING', 'APPROVED', 'REJECTED', 'PARTIAL_REFUND', 'REFUNDED'] as const;
export type RefundDecision = (typeof REFUND_DECISIONS)[number];

export const isComplaintView = (value: unknown): value is ComplaintView => (COMPLAINT_VIEWS as readonly string[]).includes(String(value));
export const isComplaintSort = (value: unknown): value is ComplaintSort => (COMPLAINT_SORTS as readonly string[]).includes(String(value));
export const isOpenComplaint = (status: string | null | undefined): boolean => (OPEN_COMPLAINT_STATUSES as readonly string[]).includes(String(status));

// ----------------------------------------------------------
// What the server answers
// ----------------------------------------------------------

export interface ComplaintPerson {
  id: number;
  name: string | null;
  role?: string | null;
}

/** One line of the list: no description, no thread, no note, no phone. */
export interface ComplaintRow {
  id: number;
  interventionId: number;
  title: string;
  status: string;
  assignedToId: number | null;
  refundRequested: boolean;
  refundDecision: string;
  refundApproved: boolean;
  /** What was accepted, in dinars; null when nothing was (or no amount was stated). */
  refundAmount: number | string | null;
  adminDecision: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  user: ComplaintPerson | null;
  assignedTo: ComplaintPerson | null;
  intervention: {
    id: number;
    serviceType: string | null;
    status: string;
    contactName: string | null;
    client: ComplaintPerson | null;
    artisan: ComplaintPerson | null;
  };
}

export type ComplaintCounts = Record<ComplaintView, number>;

/** A page of the list, with how many each view holds (under the same search and the same person; the view and status asked are left out). */
export interface ComplaintPage {
  data: ComplaintRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  counts: ComplaintCounts;
}

export interface ComplaintContact extends ComplaintPerson {
  email: string | null;
  phone: string | null;
}

export interface ComplaintMessageRow {
  id: number;
  content: string;
  isInternal: boolean;
  senderRole: string | null;
  createdAt: string;
  attachments?: string[];
  sender: ComplaintPerson | null;
}

export interface ComplaintNoteRow {
  id: number;
  content: string;
  createdAt: string;
  /** Null for a line the system wrote. */
  author: ComplaintPerson | null;
}

export interface ComplaintPayment {
  id: number;
  method: string;
  status: string;
  amount: number;
  /** What can still be given back on it. */
  refundable: number;
  confirmedAt: string | null;
}

/** The money of the job, as a decision about a refund reads it. */
export interface ComplaintMoney {
  currency: string;
  received: number;
  refunded: number;
  kept: number;
  /** The refund that was accepted and has not all gone back; null when none, or when the acceptance stated no amount. */
  accepted: number | null;
  /** What is left to pay of it. */
  remaining: number | null;
  payments: ComplaintPayment[];
  invoice: { id: number; number: string; status: string; toPay: number } | null;
}

export interface ComplaintCase {
  id: number;
  interventionId: number;
  title: string;
  description: string | null;
  status: string;
  assignedToId: number | null;
  refundRequested: boolean;
  refundDecision: string;
  refundApproved: boolean;
  refundAmount: number | string | null;
  refundDecidedAt: string | null;
  adminDecision: string | null;
  adminNotes: string | null;
  resolutionNotes: string | null;
  photos?: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  user: ComplaintContact | null;
  assignedTo: ComplaintContact | null;
  intervention: {
    id: number;
    serviceType: string | null;
    status: string;
    urgency?: string | null;
    address: string | null;
    description: string | null;
    contactName: string | null;
    contactPhone: string | null;
    clientId: number | null;
    artisanId: number | null;
    createdAt: string;
    client: ComplaintContact | null;
    artisan: ComplaintContact | null;
  };
  messages: ComplaintMessageRow[];
  internalNotes: ComplaintNoteRow[];
  money: ComplaintMoney;
}

// ----------------------------------------------------------
// Queries
// ----------------------------------------------------------

export interface ComplaintQuery {
  page?: number;
  limit?: number;
  view?: ComplaintView;
  status?: string;
  /** A person's number, to see what they handle. */
  assignedToId?: number | string;
  /** Only what the signed-in person handles. */
  mine?: boolean;
  /** A complaint number, a job number, words of the complaint, a name, a phone number. */
  search?: string;
  sort?: ComplaintSort;
}

/** The parameters of a list query without the ones left empty (a blank value is a value to the server) and `mine` as the server reads it. */
export function complaintParams(query: ComplaintQuery): Record<string, string | number> {
  const out: Record<string, string | number> = {};

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === false) continue;

    if (value === true) out[key] = 'true';
    else if (typeof value === 'string') {
      const text = value.trim();

      if (text !== '') out[key] = text;
    } else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
  }

  return out;
}

// ----------------------------------------------------------
// How a complaint reads
// ----------------------------------------------------------

type StatusInput = { status: string | null | undefined; refundDecision?: string | null };

/**
 * The status as the screens write it. The server writes REFUNDED the moment a refund is accepted, before any money has moved:
 * that is "Remboursement accepté", not "Remboursée".
 */
export function complaintStatusWords(row: StatusInput): string {
  if (row.status === 'REFUNDED' && row.refundDecision === 'APPROVED') return 'Remboursement accepté';

  return COMPLAINT_STATUS_LABELS[row.status as ComplaintStatus] ?? String(row.status ?? '');
}

export function complaintTone(row: StatusInput): StatusTone {
  if (row.status === 'REFUNDED' && row.refundDecision === 'APPROVED') return 'warning';

  return STATUS_TONES[row.status as ComplaintStatus] ?? 'waiting';
}

type RefundInput = { status?: string | null; refundRequested?: boolean | null; refundDecision?: string | null; refundAmount?: number | string | null };

/** A refund was asked for and nobody decided: "to decide" while the complaint is open, "no decision" once it was closed without one. */
const undecidedWords = (row: RefundInput): string => (row.status && !isOpenComplaint(row.status) ? 'Remboursement demandé, sans décision' : 'Remboursement demandé, à décider');

/** The state of the refund of a complaint, or null when nobody asked for one. */
export function refundStateWords(row: RefundInput, currency?: string | null): string | null {
  const amount = amountOf(row.refundAmount);

  switch (row.refundDecision) {
    case 'APPROVED':
      return amount > 0 ? `Accepté : ${moneyText(row.refundAmount, currency)}, pas encore versé` : 'Accepté (sans montant), pas encore versé';
    case 'PARTIAL_REFUND':
      return amount > 0 ? `Remboursé en partie : ${moneyText(row.refundAmount, currency)}` : 'Remboursé en partie';
    case 'REFUNDED':
      return amount > 0 ? `Remboursé : ${moneyText(row.refundAmount, currency)}` : 'Remboursé';
    case 'REJECTED':
      return 'Remboursement refusé';
    case 'PENDING':
      return undecidedWords(row);
    default:
      return row.refundRequested ? undecidedWords(row) : null;
  }
}

/** A refund that was accepted and whose money has not all gone back: finance pays it. */
export function refundIsToPay(row: RefundInput): boolean {
  return row.refundDecision === 'APPROVED';
}

/** How old a complaint is, in whole days of the calendar of Tunis; 0 for one opened today. */
export function complaintAgeDays(createdAt: string | null | undefined, now: Date = new Date()): number | null {
  if (!createdAt) return null;

  const created = new Date(createdAt);

  if (Number.isNaN(created.getTime())) return null;

  const day = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date).split('-').map(Number);

    return Math.round(Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86_400_000);
  };

  return Math.max(day(now) - day(created), 0);
}

/** "aujourd’hui", "hier", "il y a 5 jours". */
export function ageWords(days: number | null): string {
  if (days === null) return '';
  if (days <= 0) return 'aujourd’hui';
  if (days === 1) return 'hier';

  return `il y a ${days} jours`;
}

/** The people of a complaint, for the line under its title: who wrote, which job, which technician. */
export function complaintPeopleWords(row: Pick<ComplaintRow, 'user' | 'intervention'>): string {
  const parts = [row.user?.name ?? row.intervention.client?.name ?? row.intervention.contactName, row.intervention.artisan?.name ? `technicien ${row.intervention.artisan.name}` : null];

  return parts.filter((part): part is string => typeof part === 'string' && part.trim() !== '').join(' · ');
}

// ----------------------------------------------------------
// What a complaint lets the team do
// ----------------------------------------------------------

export type ComplaintAction = 'assign' | 'reply' | 'status' | 'resolve' | 'decideRefund' | 'note';

/** The statuses the team can move an open complaint to (RESOLVED has its own form, REFUNDED comes with the refund). */
export const STATUS_CHOICES = ['IN_REVIEW', 'WAITING_CLIENT', 'WAITING_ARTISAN', 'REJECTED'] as const;
export type StatusChoice = (typeof STATUS_CHOICES)[number];

export const STATUS_CHOICE_LABELS: Record<StatusChoice, string> = {
  IN_REVIEW: 'En cours de traitement',
  WAITING_CLIENT: 'En attente du client',
  WAITING_ARTISAN: 'En attente du technicien',
  REJECTED: 'Rejetée (la réclamation n’est pas fondée)',
};

/**
 * The refund the customer asked for has no answer yet. The complaint is not closed before it has one: the payout of the artisan is held
 * for a refund that waits, and a closed complaint offers no way to decide it (the server refuses the closing too).
 */
export const isRefundWaiting = (row: { refundDecision?: string | null }): boolean => row.refundDecision === 'PENDING';

/** Open complaints can be worked on; a closed one is read (it is not reopened from the screen). A complaint whose refund waits is not closed. */
export function complaintActions(row: Pick<ComplaintRow, 'status'> & RefundInput): ComplaintAction[] {
  if (!isOpenComplaint(row.status)) return ['note'];

  const actions: ComplaintAction[] = ['assign', 'reply', 'status', ...(isRefundWaiting(row) ? [] : (['resolve'] as const)), 'note'];

  if (canDecideRefund(row)) actions.push('decideRefund');

  return actions;
}

/**
 * A refund can be decided while the complaint is open and nothing was accepted yet: a first decision, or a second one after a refusal.
 * (A refusal of a closed complaint would open it again, and an acceptance cannot be taken back once money has been asked of finance.)
 */
export function canDecideRefund(row: Pick<ComplaintRow, 'status'> & RefundInput): boolean {
  return isOpenComplaint(row.status) && (row.refundDecision === 'NOT_REQUESTED' || row.refundDecision === 'PENDING' || row.refundDecision === 'REJECTED' || !row.refundDecision);
}

/** The statuses to offer for this complaint: the choices, without the one it already has, and without the rejection while its refund waits. */
export function statusChoicesFor(row: Pick<ComplaintRow, 'status'> & { refundDecision?: string | null }): StatusChoice[] {
  if (!isOpenComplaint(row.status)) return [];

  return STATUS_CHOICES.filter((choice) => choice !== row.status && !(choice === 'REJECTED' && isRefundWaiting(row)));
}

// ----------------------------------------------------------
// The forms
// ----------------------------------------------------------

export const COMPLAINT_TEXT_MIN = 3;
export const COMPLAINT_REPLY_MAX = 2000;
export const COMPLAINT_NOTE_MAX = 1000;
export const COMPLAINT_REASON_MAX = 500;

export type Read<Body> = { ok: true; body: Body } | { ok: false; message: string };

/** What was typed, trimmed; a NUL byte is dropped (PostgreSQL refuses it with an error 500). */
function textOf(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\u0000/g, '').trim() : '';
}

/** A reply on the complaint: the customer and the technician read it, unless it is internal (the team alone reads it). */
export function readReply(text: unknown, internal: unknown): Read<{ content: string; isInternal: boolean }> {
  const content = textOf(text);

  if (content === '') return { ok: false, message: 'Écrivez votre message.' };
  if (content.length > COMPLAINT_REPLY_MAX) return { ok: false, message: `Le message ne peut pas dépasser ${COMPLAINT_REPLY_MAX} caractères.` };

  return { ok: true, body: { content, isInternal: internal === true } };
}

/** A line of the journal: what the team did or knows, which the customer never reads. */
export function readJournalNote(text: unknown): Read<{ content: string }> {
  const content = textOf(text);

  if (content === '') return { ok: false, message: 'Écrivez la note.' };
  if (content.length > COMPLAINT_NOTE_MAX) return { ok: false, message: `La note ne peut pas dépasser ${COMPLAINT_NOTE_MAX} caractères.` };

  return { ok: true, body: { content } };
}

/** The new status, with a note. Rejecting says why (the team reads it back; the person who filed the complaint is told of the new status, not of the note); the other statuses take a note or none. */
export function readStatusChange(status: unknown, note: unknown): Read<{ status: StatusChoice; note?: string }> {
  if (!(STATUS_CHOICES as readonly unknown[]).includes(status)) return { ok: false, message: 'Choisissez un statut.' };

  const text = textOf(note);

  if (text.length > COMPLAINT_REASON_MAX) return { ok: false, message: `La note ne peut pas dépasser ${COMPLAINT_REASON_MAX} caractères.` };
  if (status === 'REJECTED' && text.length < COMPLAINT_TEXT_MIN) return { ok: false, message: `Dites pourquoi la réclamation est rejetée (au moins ${COMPLAINT_TEXT_MIN} caractères) : l’équipe le relira.` };

  return { ok: true, body: { status: status as StatusChoice, ...(text !== '' ? { note: text } : {}) } };
}

/** What closes a complaint as resolved: the explanation the customer reads. */
export function readResolution(text: unknown): Read<{ resolutionNotes: string }> {
  const resolutionNotes = textOf(text);

  if (resolutionNotes.length < COMPLAINT_TEXT_MIN) return { ok: false, message: `Expliquez comment la réclamation est résolue (au moins ${COMPLAINT_TEXT_MIN} caractères) : le client et le technicien de la mission le liront.` };
  if (resolutionNotes.length > COMPLAINT_REPLY_MAX) return { ok: false, message: `L’explication ne peut pas dépasser ${COMPLAINT_REPLY_MAX} caractères.` };

  return { ok: true, body: { resolutionNotes } };
}

/** The agent a complaint is given to: the number of a person of the team. */
export function readAssignee(value: unknown): Read<{ assignedToId: number }> {
  const id = typeof value === 'number' ? value : typeof value === 'string' && /^\d{1,9}$/.test(value.trim()) ? Number(value.trim()) : NaN;

  return Number.isInteger(id) && id > 0 ? { ok: true, body: { assignedToId: id } } : { ok: false, message: 'Choisissez la personne.' };
}

/**
 * The decision on a refund. Accepting states an amount: more than nothing, with at most three decimals, and not more than what the
 * customer paid on the job (the server refuses more; money never received cannot go back). Refusing needs no amount; a note says why.
 */
export function readRefundDecision(approved: unknown, amountText: unknown, note: unknown, received: number): Read<{ approved: boolean; amount?: number; note?: string }> {
  const text = textOf(note);

  if (text.length > COMPLAINT_REASON_MAX) return { ok: false, message: `La note ne peut pas dépasser ${COMPLAINT_REASON_MAX} caractères.` };
  if (approved !== true && approved !== false) return { ok: false, message: 'Choisissez d’accepter ou de refuser.' };

  const body: { approved: boolean; amount?: number; note?: string } = { approved };

  if (text !== '') body.note = text;

  if (approved === false) return { ok: true, body };

  const most = amountOf(received);

  if (most <= 0) return { ok: false, message: 'Rien n’a été encaissé sur cette mission : il n’y a rien à rembourser.' };
  if (typeof amountText !== 'string' || amountText.trim() === '') return { ok: false, message: 'Saisissez le montant accepté, en dinars (par exemple 25,000).' };

  const read = readAmount(amountText, Math.max(received, 1));

  if (!read.ok) {
    if (read.problem === 'decimals') return { ok: false, message: 'Au plus trois décimales.' };
    if (read.problem === 'too-big') return { ok: false, message: `Au plus ${moneyText(received)} : c’est ce que le client a payé sur cette mission.` };

    return { ok: false, message: 'Saisissez un montant en dinars, par exemple 25,000.' };
  }

  if (read.millimes <= 0) return { ok: false, message: 'Le montant doit être supérieur à zéro.' };
  if (read.millimes > most) return { ok: false, message: `Au plus ${moneyText(received)} : c’est ce que le client a payé sur cette mission.` };

  body.amount = read.millimes / 1000;

  return { ok: true, body };
}

/** A search typed in the box, cut to what the server reads (200 characters). */
export const COMPLAINT_SEARCH_MAX = 200;

export function searchTextOf(raw: unknown): string {
  return textOf(raw).slice(0, COMPLAINT_SEARCH_MAX);
}
