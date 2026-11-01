import { DEFAULT_LOCALE, type Locale } from './generated/i18n';
import type { TradeCode } from './generated/trades';
import { TRADE_CODES } from './generated/trades';
import type { TrackingIntervention, TrackingInterventionSubService } from './generated/views';
import { BotCheckBody } from './bot-check';
import { message } from './i18n';
import { coordinatesOf } from './navigation';
import { normalizePhone, phoneProblem } from './phone';
import { charactersText, isolateFor, photosText } from './words';

/**
 * The request a visitor makes without an account (P1-16): what the form asks, what is sent, and what comes back.
 *
 * The numbers below are the server's own limits (create-guest-intervention.dto.ts and guest.service.ts there). The
 * form stops a little earlier where the server's ceiling is only there to bound abuse (a description of 2000
 * characters is allowed, 1000 is asked), and exactly at the same place where the server counts (6 photos).
 *
 * The sentences that tell what is wrong are in the catalogue (`guest.problems.*`, `guest.photos.*`): a function that returns one takes
 * the language as its last argument (`locale`, French when it is left out), or in the `locale` of its `context` where it has one.
 */
export const GUEST_LIMITS = {
  descriptionMin: 10,
  descriptionMax: 1000,
  addressMin: 5,
  addressMax: 300,
  accessMax: 500,
  nameMin: 2,
  nameMax: 100,
  emailMax: 254,
  /** A picture the server accepts: JPEG, PNG or WebP, at most 5 MB. */
  photoBytes: 5 * 1024 * 1024,
  photoTypes: ['image/jpeg', 'image/png', 'image/webp'],
  /** Pictures in one upload call, and on one request in all. */
  photosPerCall: 5,
  photosTotal: 6,
  problemMin: 5,
  problemMax: 1000,
  feedbackMax: 1000,
} as const;

// ----------------------------------------------------------
// The catalog (GET /services)
// ----------------------------------------------------------

/** A sub-service of the public catalog ("Fuite d'eau"). Durations are minutes, prices are dinars (null = on quote). */
export type PublicSubService = TrackingInterventionSubService;

export interface PublicCategory {
  id: number;
  serviceType: string;
  name: string;
  description: string | null;
  isActive: boolean;
  subServices: PublicSubService[];
}

/** The category of a trade, with the sub-services that can be picked (the active ones), or null when the catalog has none. */
export function categoryOfTrade(catalog: readonly PublicCategory[] | null | undefined, trade: string): PublicCategory | null {
  const category = (catalog ?? []).find((item) => item.serviceType === trade && item.isActive !== false);

  if (!category) return null;

  return { ...category, subServices: (category.subServices ?? []).filter((sub) => sub.isActive !== false) };
}

/** Dinars as written in French: "89 DT", "45,5 DT" (a dinar has 1000 millimes, so up to three decimals). In Arabic the unit is "د.ت". */
export function dinars(amount: number, locale: Locale = DEFAULT_LOCALE): string {
  return `${String(Number(amount.toFixed(3))).replace('.', ',')} ${message(locale, 'money.unit')}`;
}

/** What a sub-service costs, as the catalog says: "À partir de 89 DT", or "Sur devis" when it has no list price. */
export function priceText(sub: Pick<PublicSubService, 'basePrice'>, locale: Locale = DEFAULT_LOCALE): string {
  return typeof sub.basePrice === 'number' && Number.isFinite(sub.basePrice) && sub.basePrice > 0
    ? message(locale, 'money.price.from', { price: isolateFor(locale, dinars(sub.basePrice, locale)) })
    : message(locale, 'money.price.onQuote');
}

/** "45 min", "1 h", "1 h 15" ("45 د", "1 س", "1 س 15 د"): the usual duration of a sub-service, or null when the catalog gives none. */
export function durationText(minutes: number | null | undefined, locale: Locale = DEFAULT_LOCALE): string | null {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) return null;

  const total = Math.round(minutes);

  if (total < 60) return message(locale, 'money.duration.minutes', { minutes: total });

  const rest = total % 60;

  return rest === 0
    ? message(locale, 'money.duration.hours', { hours: total / 60 })
    : message(locale, 'money.duration.hoursMinutes', { hours: Math.floor(total / 60), minutes: locale === 'ar' ? rest : String(rest).padStart(2, '0') });
}

// ----------------------------------------------------------
// The form
// ----------------------------------------------------------

export type GuestStep = 'problem' | 'place' | 'contact';

/** The three steps of the wizard, in order. */
export const GUEST_STEPS: readonly GuestStep[] = ['problem', 'place', 'contact'];

/** What the wizard collects. Texts are as typed; the pictures themselves stay in the page, only their number matters here. */
export interface GuestRequestForm {
  serviceType: TradeCode | '';
  subServiceId: number | null;
  description: string;
  photoCount: number;
  address: string;
  accessInstructions: string;
  latitude: number | null;
  longitude: number | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

export const EMPTY_GUEST_FORM: GuestRequestForm = {
  serviceType: '',
  subServiceId: null,
  description: '',
  photoCount: 0,
  address: '',
  accessInstructions: '',
  latitude: null,
  longitude: null,
  contactName: '',
  contactPhone: '',
  contactEmail: '',
};

export type FieldProblems = Partial<Record<keyof GuestRequestForm, string>>;

/** What a step needs to know that is not in the form: the sub-service picked, if the catalog says it wants photos; and the language of the sentences. */
export interface GuestContext {
  requiresPhotos?: boolean;
  /** The language the problems are told in (French when left out). */
  locale?: Locale;
}

/** Changing the trade drops the sub-service (it belongs to the old trade). */
export function withTrade(form: GuestRequestForm, trade: TradeCode): GuestRequestForm {
  return form.serviceType === trade ? form : { ...form, serviceType: trade, subServiceId: null };
}

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function problemsOfProblemStep(form: GuestRequestForm, context: GuestContext): FieldProblems {
  const locale = context.locale ?? DEFAULT_LOCALE;
  const problems: FieldProblems = {};
  const description = form.description.trim();

  if (!form.serviceType || !(TRADE_CODES as readonly string[]).includes(form.serviceType)) {
    problems.serviceType = message(locale, 'guest.problems.serviceType');
  }

  if (description.length < GUEST_LIMITS.descriptionMin) {
    problems.description = message(locale, 'guest.problems.descriptionShort', { min: charactersText(GUEST_LIMITS.descriptionMin, locale) });
  } else if (description.length > GUEST_LIMITS.descriptionMax) {
    problems.description = message(locale, 'guest.problems.descriptionLong', { max: charactersText(GUEST_LIMITS.descriptionMax, locale) });
  }

  if (context.requiresPhotos && form.photoCount < 1) {
    problems.photoCount = message(locale, 'guest.problems.photoRequired');
  }

  return problems;
}

function problemsOfPlaceStep(form: GuestRequestForm, locale: Locale): FieldProblems {
  const problems: FieldProblems = {};
  const address = form.address.trim();

  if (address.length < GUEST_LIMITS.addressMin) {
    problems.address = message(locale, 'guest.problems.addressShort');
  } else if (address.length > GUEST_LIMITS.addressMax) {
    problems.address = message(locale, 'guest.problems.addressLong', { max: charactersText(GUEST_LIMITS.addressMax, locale) });
  }

  if (form.accessInstructions.trim().length > GUEST_LIMITS.accessMax) {
    problems.accessInstructions = message(locale, 'guest.problems.accessLong', { max: charactersText(GUEST_LIMITS.accessMax, locale) });
  }

  // A position is both numbers or neither: one number alone, or a point that is not on Earth (or the 0,0 of "nothing"), is dropped.
  if ((form.latitude === null) !== (form.longitude === null)) {
    problems.latitude = message(locale, 'guest.problems.positionIncomplete');
  } else if (form.latitude !== null && !coordinatesOf({ latitude: form.latitude, longitude: form.longitude })) {
    problems.latitude = message(locale, 'guest.problems.positionInvalid');
  }

  return problems;
}

function problemsOfContactStep(form: GuestRequestForm, locale: Locale): FieldProblems {
  const problems: FieldProblems = {};
  const name = form.contactName.trim();
  const email = form.contactEmail.trim();
  const phone = phoneProblem(form.contactPhone, locale);

  if (name.length < GUEST_LIMITS.nameMin) {
    problems.contactName = message(locale, 'guest.problems.nameRequired');
  } else if (name.length > GUEST_LIMITS.nameMax) {
    problems.contactName = message(locale, 'guest.problems.nameLong', { max: charactersText(GUEST_LIMITS.nameMax, locale) });
  }

  if (phone) problems.contactPhone = phone;

  if (email && (email.length > GUEST_LIMITS.emailMax || !EMAIL_FORMAT.test(email))) {
    problems.contactEmail = message(locale, 'guest.problems.emailInvalid');
  }

  return problems;
}

/** What is wrong in one step of the wizard, by field; empty when the step can be left. The sentences are in `context.locale`. */
export function stepProblems(step: GuestStep, form: GuestRequestForm, context: GuestContext = {}): FieldProblems {
  if (step === 'problem') return problemsOfProblemStep(form, context);
  if (step === 'place') return problemsOfPlaceStep(form, context.locale ?? DEFAULT_LOCALE);

  return problemsOfContactStep(form, context.locale ?? DEFAULT_LOCALE);
}

/** The first step that cannot be left, or null when the whole form is good. */
export function firstStepWithProblem(form: GuestRequestForm, context: GuestContext = {}): GuestStep | null {
  return GUEST_STEPS.find((step) => Object.keys(stepProblems(step, form, context)).length > 0) ?? null;
}

/** The body of POST /guest/interventions. */
export interface GuestRequestBody extends BotCheckBody {
  serviceType: string;
  subServiceId?: number;
  description: string;
  address: string;
  latitude?: number;
  longitude?: number;
  accessInstructions?: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
}

export type BuiltRequest = { ok: true; body: GuestRequestBody } | { ok: false; step: GuestStep; problems: FieldProblems };

/**
 * The body to send for a form: texts trimmed, empty optional fields left out, the phone number in E.164 (+216...),
 * and the bot check fields added. A form with a problem gives the first step to go back to, not a body.
 */
export function buildGuestRequest(form: GuestRequestForm, bot: BotCheckBody, context: GuestContext = {}): BuiltRequest {
  const step = firstStepWithProblem(form, context);

  if (step) return { ok: false, step, problems: stepProblems(step, form, context) };

  const phone = normalizePhone(form.contactPhone);
  const email = form.contactEmail.trim();
  const access = form.accessInstructions.trim();
  const body: GuestRequestBody = {
    serviceType: form.serviceType,
    description: form.description.trim(),
    address: form.address.trim(),
    contactName: form.contactName.trim(),
    // The form is good, so the number is: the cast only says it to the compiler.
    contactPhone: phone.ok ? phone.e164 : form.contactPhone.trim(),
    ...bot,
  };

  if (form.subServiceId !== null) body.subServiceId = form.subServiceId;
  if (form.latitude !== null && form.longitude !== null) {
    body.latitude = form.latitude;
    body.longitude = form.longitude;
  }
  if (access) body.accessInstructions = access;
  if (email) body.contactEmail = email;

  return { ok: true, body };
}

// ----------------------------------------------------------
// The answers
// ----------------------------------------------------------

/** What POST /guest/interventions answers. `rawTrackingToken` is shown once: it is the link's secret. */
export interface GuestCreated {
  intervention: TrackingIntervention;
  trackingUrl: string;
  rawTrackingToken: string;
  /** The sub-service picked asks for photos of the problem. */
  photosRequired: boolean;
  message: string;
}

/** What POST /guest/interventions/:id/photos answers: how many were kept and which positions were refused. */
export interface GuestPhotosAnswer {
  added: number;
  photos: Array<{ id: number }>;
  refused: Array<{ position: number; reason: string }>;
  message: string;
}

/** What POST /guest/interventions/:id/problems answers: the complaint that was opened. */
export interface GuestProblemAnswer {
  id: number;
  status: string;
  message: string;
}

/** The body of POST /guest/interventions/:id/feedback. */
export interface GuestFeedbackBody {
  rating: number;
  isOnTime?: boolean;
  feedbackNotes?: string;
}

/** The body of POST /guest/interventions/:id/problems. */
export interface GuestProblemBody {
  title?: string;
  description: string;
}

/** What is wrong in an opinion before it is sent, or null. The text is optional; the stars are not. */
export function feedbackProblem(body: { rating: number; feedbackNotes?: string }, locale: Locale = DEFAULT_LOCALE): string | null {
  if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) return message(locale, 'guest.problems.ratingRequired');

  if ((body.feedbackNotes ?? '').trim().length > GUEST_LIMITS.feedbackMax) {
    return message(locale, 'guest.problems.commentLong', { max: charactersText(GUEST_LIMITS.feedbackMax, locale) });
  }

  return null;
}

/** What is wrong in a problem report before it is sent, or null. */
export function problemReportProblem(description: string, locale: Locale = DEFAULT_LOCALE): string | null {
  const length = description.trim().length;

  if (length < GUEST_LIMITS.problemMin) return message(locale, 'guest.problems.reportShort', { min: charactersText(GUEST_LIMITS.problemMin, locale) });
  if (length > GUEST_LIMITS.problemMax) return message(locale, 'guest.problems.reportLong', { max: charactersText(GUEST_LIMITS.problemMax, locale) });

  return null;
}

// ----------------------------------------------------------
// Pictures
// ----------------------------------------------------------

/** What the page knows of a picture the person picked. */
export interface PhotoCandidate {
  name: string;
  type: string;
  size: number;
}

/**
 * Why a picture cannot be sent, or null. A phone's HEIC picture is turned into JPEG by the browser before it gets here. The name of the
 * file is Latin text whatever the language: in Arabic it is set apart from the sentence.
 */
export function photoProblem(file: PhotoCandidate, locale: Locale = DEFAULT_LOCALE): string | null {
  const name = isolateFor(locale, file.name);

  if (!(GUEST_LIMITS.photoTypes as readonly string[]).includes(file.type)) {
    return message(locale, 'guest.photos.badType', { name, jpeg: isolateFor(locale, 'JPEG'), png: isolateFor(locale, 'PNG'), webp: isolateFor(locale, 'WebP') });
  }

  if (file.size <= 0) return message(locale, 'guest.photos.empty', { name });

  if (file.size > GUEST_LIMITS.photoBytes) return message(locale, 'guest.photos.tooBig', { name, megabytes: GUEST_LIMITS.photoBytes / (1024 * 1024) });

  return null;
}

/**
 * Which of the pictures just picked to keep, given how many the request already holds: the good ones, in order, up to
 * the room left (6 in all). The others come back as sentences.
 */
export function pickPhotos(already: number, picked: readonly PhotoCandidate[], locale: Locale = DEFAULT_LOCALE): { keep: number[]; problems: string[] } {
  const keep: number[] = [];
  const problems: string[] = [];
  let room = Math.max(0, GUEST_LIMITS.photosTotal - already);

  picked.forEach((file, index) => {
    const problem = photoProblem(file, locale);

    if (problem) {
      problems.push(problem);
    } else if (room <= 0) {
      problems.push(message(locale, 'guest.photos.tooMany', { name: isolateFor(locale, file.name), max: photosText(GUEST_LIMITS.photosTotal, locale) }));
    } else {
      keep.push(index);
      room--;
    }
  });

  return { keep, problems };
}

/** Pictures split into the calls the server accepts (5 at a time). */
export function photoBatches<T>(files: readonly T[]): T[][] {
  const calls: T[][] = [];

  for (let at = 0; at < files.length; at += GUEST_LIMITS.photosPerCall) calls.push(files.slice(at, at + GUEST_LIMITS.photosPerCall));

  return calls;
}

/** A picture's size once it fits in a square of `longest` pixels, keeping its proportions; never larger than it was. */
export function fitWithin(width: number, height: number, longest = 1600): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };

  const scale = Math.min(1, longest / Math.max(width, height));

  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Pictures above this size are shrunk before they are sent (a phone's picture is often 3 to 8 MB; the server takes 5). */
export const PHOTO_SHRINK_ABOVE_BYTES = 1_000_000;
