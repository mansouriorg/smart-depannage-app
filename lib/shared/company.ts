import { amountOf } from './customer';
import { readAmount } from './money';

/**
 * The company settings screen (P2-09): what the invoices print about the company, the VAT rates, the stamp duty, the payment
 * methods. The server side is `GET` and `PATCH /admin/settings/company` (src/modules/admin). Written by hand, like `finance.ts`.
 *
 * The form keeps every field as the text the person typed. `readCompanyForm` checks it the way the server will, and builds the
 * body of the request from what changed only: a field left as it was is not sent, so a change to the policies or to the payment
 * methods never touches the accountant's confirmation. A change to something an invoice prints (the name, the phone, the VAT
 * rates...) does take it away, as the server does, and the form says so before it is saved (`unconfirms`).
 */

export interface TaxRate {
  code: string;
  label: string;
  rate: number;
}

/** The settings as the server answers them (a Decimal column reaches the screen as a number or as text). */
export interface CompanySettings {
  id: number;
  companyName: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  smsSender: string | null;
  currency: string;
  timezone: string;
  taxRates: TaxRate[] | null;
  defaultTaxRate: number | string;
  defaultEmergencyFee: number | string;
  rib: string | null;
  matriculeFiscal: string | null;
  companyAddress: string | null;
  registreCommerce: string | null;
  invoiceLegalMentions: string | null;
  paymentTerms: string | null;
  stampDuty: number | string;
  invoiceRulesConfirmedAt: string | null;
  invoiceRulesConfirmedBy: string | null;
  openingHours?: unknown;
  paymentMethods: string[];
  termsAndConditions: string | null;
  privacyPolicy: string | null;
  updatedAt?: string;
}

// ----------------------------------------------------------
// The limits the server keeps
// ----------------------------------------------------------

export const COMPANY_NAME_MAX = 150;
export const COMPANY_PHONE_MAX = 40;
export const COMPANY_ADDRESS_MAX = 300;
export const REGISTRE_COMMERCE_MAX = 40;
export const LEGAL_MENTIONS_MAX = 2000;
export const PAYMENT_TERMS_MAX = 300;
export const CONFIRMED_BY_MAX = 120;
export const TAX_RATES_MAX = 20;
export const TAX_LABEL_MAX = 80;
/** The most the stamp duty can be (the server refuses more: a typing error). */
export const STAMP_DUTY_MAX = 100;
/**
 * Limits of the form that the server does not set (it only asks for a text, or for an amount): a guard against a paste gone wrong. A
 * policy stays well under the 100 kb that the server reads from one request, even in a script of two bytes a letter, and a text that is
 * already longer is left alone until it is edited.
 */
export const POLICY_TEXT_MAX = 20_000;
export const EMERGENCY_FEE_MAX = 100_000;

/** The ways of paying the company can offer. The server reads "online" and "card" as one way, so the form has one box for both. */
export const PAYMENT_METHOD_CHOICES = ['ONLINE', 'CASH', 'BANK_TRANSFER'] as const;

export const PAYMENT_METHOD_CHOICE_LABELS: Record<(typeof PAYMENT_METHOD_CHOICES)[number], string> = {
  ONLINE: 'Paiement en ligne (carte bancaire)',
  CASH: 'Espèces',
  BANK_TRANSFER: 'Virement',
};

/** What a company that never chose offers: the server reads a missing or an empty list as these three. */
export const DEFAULT_PAYMENT_METHODS: readonly string[] = ['ONLINE', 'CASH', 'BANK_TRANSFER'];

/** The ways of paying a settings row stands for, as the boxes of the form: the default three for a row without a list, the card as "online". */
export function paymentMethodsOf(list: readonly string[] | null | undefined): string[] {
  const listed = Array.isArray(list) ? list.map(String) : [];
  const named = listed.length === 0 ? DEFAULT_PAYMENT_METHODS : listed;

  return [...new Set(named.map((method) => (method === 'ONLINE_CARD' ? 'ONLINE' : method)))];
}

// ----------------------------------------------------------
// The spellings the server keeps
// ----------------------------------------------------------

/** "08 006 0123456789012 34" -> "08006012345678901234"; null when it is not 20 digits. */
export function normalizeRib(value: string): string | null {
  const digits = value.replace(/[\s.-]/g, '');

  return /^\d{20}$/.test(digits) ? digits : null;
}

/** "1234567 a/m/000" -> "1234567A/M/000"; null when it is not seven digits, a letter, then the codes of the category and the establishment. */
export function normalizeMatricule(value: string): string | null {
  const text = value.trim().toUpperCase().replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ');

  return /^\d{7}[\s/]?[A-Z](?:[\s/]?[A-Z0-9]){0,12}$/.test(text) ? text.replace(/\s/g, '') : null;
}

/** "08006012345678901234" -> "08 006 0123456789012 34", the way a bank writes it. */
export function ribText(value: string | null | undefined): string {
  const rib = (value ?? '').replace(/\s/g, '');

  return /^\d{20}$/.test(rib) ? `${rib.slice(0, 2)} ${rib.slice(2, 5)} ${rib.slice(5, 18)} ${rib.slice(18)}` : (value ?? '');
}

/** A percent as typed ("19", "7,5"), read with at most two decimals between 0 and 100; null when it is not one. */
export function readRate(text: unknown): number | null {
  if (typeof text !== 'string' && typeof text !== 'number') return null;

  const typed = String(text).trim().replace(',', '.');

  if (!/^\d{1,3}(\.\d{1,2})?$/.test(typed)) return null;

  const rate = Number(typed);

  return rate >= 0 && rate <= 100 ? rate : null;
}

const rateText = (rate: number | string | null | undefined): string => {
  const value = Number(rate);

  return Number.isFinite(value) ? String(value).replace('.', ',') : '';
};

// ----------------------------------------------------------
// The form
// ----------------------------------------------------------

export interface CompanyFormRate {
  code: string;
  label: string;
  rate: string;
}

export interface CompanyForm {
  companyName: string;
  companyPhone: string;
  companyEmail: string;
  companyAddress: string;
  matriculeFiscal: string;
  registreCommerce: string;
  rib: string;
  invoiceLegalMentions: string;
  paymentTerms: string;
  stampDuty: string;
  defaultEmergencyFee: string;
  taxRates: CompanyFormRate[];
  defaultTaxRate: string;
  paymentMethods: string[];
  termsAndConditions: string;
  privacyPolicy: string;
  /** The accountant has seen the mentions, the VAT rates and the stamp duty as they stand in this form. */
  confirm: boolean;
  confirmedBy: string;
}

/** The rates a settings row stands for: its own list, else the rates of the country (19, 13, 7 and none). */
export const DEFAULT_TAX_RATE_LIST: readonly TaxRate[] = [
  { code: 'STANDARD', label: 'TVA 19 %', rate: 19 },
  { code: 'REDUCED_13', label: 'TVA 13 %', rate: 13 },
  { code: 'REDUCED_7', label: 'TVA 7 %', rate: 7 },
  { code: 'EXEMPT', label: 'Exonéré', rate: 0 },
];

export const taxRatesOf = (settings: Pick<CompanySettings, 'taxRates'>): TaxRate[] =>
  Array.isArray(settings.taxRates) && settings.taxRates.length > 0 ? settings.taxRates.map((rate) => ({ ...rate })) : DEFAULT_TAX_RATE_LIST.map((rate) => ({ ...rate }));

const dinars = (value: number | string | null | undefined): string => {
  const millimes = amountOf(value);
  const whole = Math.trunc(millimes / 1000);
  const fraction = String(millimes % 1000).padStart(3, '0').replace(/0+$/, '');

  return fraction === '' ? String(whole) : `${whole},${fraction}`;
};

/** The form as it opens: every field with what the settings hold. `confirmedBy` starts with the name of the person who is signed in (the one who confirms). */
export function companyFormOf(settings: CompanySettings, signedInName = ''): CompanyForm {
  return {
    companyName: settings.companyName ?? '',
    companyPhone: settings.companyPhone ?? '',
    companyEmail: settings.companyEmail ?? '',
    companyAddress: settings.companyAddress ?? '',
    matriculeFiscal: settings.matriculeFiscal ?? '',
    registreCommerce: settings.registreCommerce ?? '',
    rib: ribText(settings.rib),
    invoiceLegalMentions: settings.invoiceLegalMentions ?? '',
    paymentTerms: settings.paymentTerms ?? '',
    stampDuty: dinars(settings.stampDuty),
    defaultEmergencyFee: dinars(settings.defaultEmergencyFee),
    taxRates: taxRatesOf(settings).map((rate) => ({ code: rate.code, label: rate.label, rate: rateText(rate.rate) })),
    defaultTaxRate: rateText(settings.defaultTaxRate),
    paymentMethods: paymentMethodsOf(settings.paymentMethods),
    termsAndConditions: settings.termsAndConditions ?? '',
    privacyPolicy: settings.privacyPolicy ?? '',
    confirm: false,
    confirmedBy: signedInName.trim() || (settings.invoiceRulesConfirmedBy ?? ''),
  };
}

/** What the server is sent: only what changed. */
export interface CompanyBody {
  companyName?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyAddress?: string;
  matriculeFiscal?: string;
  registreCommerce?: string;
  rib?: string;
  invoiceLegalMentions?: string;
  paymentTerms?: string;
  stampDuty?: number;
  defaultEmergencyFee?: number;
  taxRates?: TaxRate[];
  defaultTaxRate?: number;
  paymentMethods?: string[];
  termsAndConditions?: string;
  privacyPolicy?: string;
  invoiceRulesConfirmed?: true;
  invoiceRulesConfirmedBy?: string;
}

export type CompanyField = keyof CompanyForm;

export type CompanyProblems = Partial<Record<CompanyField, string>>;

export type CompanyRead = { ok: true; body: CompanyBody; changed: boolean; unconfirms: boolean } | { ok: false; problems: CompanyProblems; message: string };

/** What an invoice or a credit note prints: a change to any of these takes the accountant's confirmation away. */
export const PRINTED_FIELDS: readonly (keyof CompanyBody)[] = [
  'companyName',
  'companyPhone',
  'companyEmail',
  'companyAddress',
  'matriculeFiscal',
  'registreCommerce',
  'rib',
  'invoiceLegalMentions',
  'paymentTerms',
  'stampDuty',
  'taxRates',
  'defaultTaxRate',
];

const EMAIL_LOCAL = /^[^\s@"(),.:;<>[\]\\]+(\.[^\s@"(),.:;<>[\]\\]+)*$/;
const EMAIL_LABEL = /^[\p{L}\p{N}]([\p{L}\p{N}-]*[\p{L}\p{N}])?$/u;
const EMAIL_EXTENSION = /^(\p{L}{2,}|xn--[a-z0-9-]{2,})$/iu;

/**
 * An address the server accepts (`@IsEmail`): a name without spaces, quotes or doubled dots, then "@", then a domain of labels
 * made of letters, digits and hyphens (a hyphen is never first or last, an underscore is not allowed), ending with an extension
 * of letters ("tn", "com"), not of digits.
 */
export function looksLikeEmail(email: string): boolean {
  const at = email.lastIndexOf('@');

  if (at < 1 || email.length > 254) return false;

  const local = email.slice(0, at);
  const labels = email.slice(at + 1).split('.');

  if (local.length > 64 || !EMAIL_LOCAL.test(local) || labels.length < 2) return false;

  return labels.every((label) => label.length >= 1 && label.length <= 63 && EMAIL_LABEL.test(label)) && EMAIL_EXTENSION.test(labels[labels.length - 1]);
}

/** The same text whatever the order of the keys of an object in it: the database keeps the keys of a JSON column in its own order. */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, inner) =>
    inner && typeof inner === 'object' && !Array.isArray(inner) ? Object.fromEntries(Object.entries(inner as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : inner,
  );

const sameList = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((value, index) => canonical(value) === canonical(b[index]));

/**
 * The body of the request from the form, checked the way the server checks it. `changed` is false when nothing differs from the
 * settings (and nothing is confirmed): the screen leaves the button off. `unconfirms` is true when the request changes something an
 * invoice prints while a confirmation stands and is not renewed: the server will take the confirmation away, and the screen says so.
 */
export function readCompanyForm(form: CompanyForm, settings: CompanySettings): CompanyRead {
  const problems: CompanyProblems = {};
  const body: CompanyBody = {};
  // A NUL byte is dropped: PostgreSQL refuses it with an error 500.
  const text = (value: unknown) => (typeof value === 'string' ? value.replace(/\u0000/g, '').trim() : '');

  // A text field that is sent only when it differs, with its limit; an empty text clears it where the server lets it.
  const plain = (field: 'companyPhone' | 'companyAddress' | 'registreCommerce' | 'invoiceLegalMentions' | 'paymentTerms', max: number, label: string) => {
    const typed = text(form[field]);
    const was = (settings[field] ?? '').trim();

    if (typed.length > max) problems[field] = `${label} : au plus ${max} caractères.`;
    else if (typed !== was) body[field] = typed;
  };

  const name = text(form.companyName);

  if (name === '') problems.companyName = 'Le nom de l’entreprise est imprimé sur chaque facture : écrivez-le.';
  else if (name.length > COMPANY_NAME_MAX) problems.companyName = `Le nom : au plus ${COMPANY_NAME_MAX} caractères.`;
  else if (name !== (settings.companyName ?? '').trim()) body.companyName = name;

  plain('companyPhone', COMPANY_PHONE_MAX, 'Le téléphone');
  plain('companyAddress', COMPANY_ADDRESS_MAX, 'L’adresse');
  plain('registreCommerce', REGISTRE_COMMERCE_MAX, 'Le registre de commerce');
  plain('invoiceLegalMentions', LEGAL_MENTIONS_MAX, 'Les mentions légales');
  plain('paymentTerms', PAYMENT_TERMS_MAX, 'Les conditions de paiement');

  // The e-mail: the server accepts an address, never an empty text (it keeps what it has).
  const email = text(form.companyEmail);
  const emailWas = (settings.companyEmail ?? '').trim();

  if (email === '') {
    if (emailWas !== '') problems.companyEmail = 'L’adresse e-mail ne peut pas être effacée : remplacez-la par une autre.';
  } else if (!looksLikeEmail(email)) problems.companyEmail = 'Saisissez une adresse e-mail valide, par exemple contact@exemple.tn.';
  else if (email !== emailWas) body.companyEmail = email;

  // The matricule fiscal and the RIB are kept in one spelling; an empty text clears them.
  const matricule = text(form.matriculeFiscal);

  if (matricule === '') {
    if ((settings.matriculeFiscal ?? '') !== '') body.matriculeFiscal = '';
  } else {
    const normal = normalizeMatricule(matricule);

    if (normal === null) problems.matriculeFiscal = 'Sept chiffres, une lettre, puis les codes de la catégorie et de l’établissement (exemple : 1234567A/M/000).';
    else if (normal !== (normalizeMatricule(settings.matriculeFiscal ?? '') ?? settings.matriculeFiscal ?? '')) body.matriculeFiscal = normal;
  }

  const rib = text(form.rib);

  if (rib === '') {
    if ((settings.rib ?? '') !== '') body.rib = '';
  } else {
    const normal = normalizeRib(rib);

    if (normal === null) problems.rib = 'Le RIB compte 20 chiffres (banque, agence, compte et clé). Les espaces sont acceptés.';
    else if (normal !== (settings.rib ?? '')) body.rib = normal;
  }

  // The stamp duty and the emergency fee are amounts in dinars; nothing typed is 0.
  const amount = (field: 'stampDuty' | 'defaultEmergencyFee', most: number, label: string) => {
    const typed = text(form[field]);
    const read = typed === '' ? ({ ok: true, millimes: 0 } as const) : readAmount(typed, most);

    if (!read.ok) {
      problems[field] =
        read.problem === 'decimals' ? `${label} : au plus trois décimales.` : read.problem === 'too-big' ? `${label} : au plus ${most} DT.` : `${label} : saisissez un montant en dinars, par exemple 1,000.`;
    } else if (read.millimes !== amountOf(settings[field])) {
      body[field] = read.millimes / 1000;
    }
  };

  amount('stampDuty', STAMP_DUTY_MAX, 'Le timbre fiscal');
  amount('defaultEmergencyFee', EMERGENCY_FEE_MAX, 'Le supplément d’urgence');

  // The list of rates, and the default rate, which is one of them.
  const rates: TaxRate[] = [];
  const seen = new Set<string>();
  let ratesWrong = false;

  if (form.taxRates.length === 0 || form.taxRates.length > TAX_RATES_MAX) {
    problems.taxRates = form.taxRates.length === 0 ? 'Gardez au moins un taux de TVA.' : `Au plus ${TAX_RATES_MAX} taux.`;
    ratesWrong = true;
  } else {
    for (const entry of form.taxRates) {
      const code = text(entry.code).toUpperCase();
      const label = text(entry.label);
      const rate = readRate(entry.rate);

      if (!/^[A-Z0-9_]{1,32}$/.test(code)) problems.taxRates = 'Le code d’un taux : des lettres majuscules, des chiffres et _ (32 au plus).';
      else if (seen.has(code)) problems.taxRates = `Le code ${code} est là deux fois.`;
      else if (rate === null) problems.taxRates = `Le taux de ${code || 'la ligne'} est un pourcentage de 0 à 100, avec deux décimales au plus.`;
      else if (label.length > TAX_LABEL_MAX) problems.taxRates = `Le nom d’un taux : au plus ${TAX_LABEL_MAX} caractères.`;
      else {
        seen.add(code);
        rates.push({ code, label: label || `${rateText(rate)} %`, rate });
        continue;
      }

      ratesWrong = true;
      break;
    }
  }

  const defaultRate = readRate(form.defaultTaxRate);

  if (defaultRate === null) problems.defaultTaxRate = 'Choisissez le taux appliqué par défaut.';
  else if (!ratesWrong && !rates.some((rate) => rate.rate === defaultRate)) problems.defaultTaxRate = 'Le taux par défaut doit être l’un des taux de la liste.';

  if (!ratesWrong && !sameList(rates, taxRatesOf(settings))) body.taxRates = rates;

  if (defaultRate !== null && defaultRate !== Number(settings.defaultTaxRate)) body.defaultTaxRate = defaultRate;

  // The payment methods the platform offers.
  const methods = [...new Set(form.paymentMethods.map((method) => (method === 'ONLINE_CARD' ? 'ONLINE' : method)))];

  if (methods.length === 0) problems.paymentMethods = 'Gardez au moins un moyen de paiement.';
  else if (methods.some((method) => !(PAYMENT_METHOD_CHOICES as readonly string[]).includes(method))) problems.paymentMethods = 'Un moyen de paiement est inconnu.';
  else if (!sameList([...methods].sort(), [...paymentMethodsOf(settings.paymentMethods)].sort())) body.paymentMethods = methods;

  for (const field of ['termsAndConditions', 'privacyPolicy'] as const) {
    const typed = text(form[field]);

    // A text that was not touched is not checked: one that is already longer than the form allows must not stop another change.
    if (typed === (settings[field] ?? '').trim()) continue;

    if (typed.length > POLICY_TEXT_MAX) problems[field] = `Au plus ${POLICY_TEXT_MAX} caractères.`;
    else body[field] = typed;
  }

  // The accountant's confirmation of the mentions, the VAT rates and the stamp duty.
  if (form.confirm) {
    const by = text(form.confirmedBy);

    if (by === '') problems.confirmedBy = 'Indiquez qui confirme les mentions.';
    else if (by.length > CONFIRMED_BY_MAX) problems.confirmedBy = `Au plus ${CONFIRMED_BY_MAX} caractères.`;

    const after = (field: 'companyName' | 'companyAddress' | 'matriculeFiscal') => (field in body ? (body[field] ?? '') : (settings[field] ?? '')).trim();
    const missing = [after('companyName') === '' ? 'le nom de l’entreprise' : null, after('companyAddress') === '' ? 'l’adresse' : null, after('matriculeFiscal') === '' ? 'le matricule fiscal' : null].filter(
      (item): item is string => item !== null,
    );

    if (missing.length > 0) problems.confirm = `Les mentions ne peuvent pas être confirmées : renseignez d’abord ${missing.length > 1 ? `${missing.slice(0, -1).join(', ')} et ${missing[missing.length - 1]}` : missing[0]}.`;

    if (by !== '' && by.length <= CONFIRMED_BY_MAX) {
      body.invoiceRulesConfirmed = true;
      body.invoiceRulesConfirmedBy = by;
    }
  }

  const wrong = Object.keys(problems) as CompanyField[];

  if (wrong.length > 0) return { ok: false, problems, message: problems[wrong[0]] ?? 'Vérifiez le formulaire.' };

  const unconfirms = !form.confirm && settings.invoiceRulesConfirmedAt !== null && PRINTED_FIELDS.some((field) => field in body);

  return { ok: true, body, changed: Object.keys(body).length > 0, unconfirms };
}

// ----------------------------------------------------------
// What the invoices print
// ----------------------------------------------------------

/** "Confirmé par Sami le 24 octobre 2026", or why the invoices say the mentions were not confirmed. */
export function confirmationWords(settings: Pick<CompanySettings, 'invoiceRulesConfirmedAt' | 'invoiceRulesConfirmedBy'>, dayOf: (iso: string | null | undefined) => string | null): string {
  if (!settings.invoiceRulesConfirmedAt) return 'Pas encore confirmées par le comptable : les factures émises d’ici là sont repérées « mentions non confirmées » dans Finance.';

  const day = dayOf(settings.invoiceRulesConfirmedAt);
  const by = (settings.invoiceRulesConfirmedBy ?? '').trim();

  return `Confirmées${by ? ` par ${by}` : ''}${day ? ` le ${day}` : ''}.`;
}

/**
 * The lines at the top of an invoice, as the PDF writes them from the company's settings: the name, the address, the phone, the
 * e-mail, the matricule fiscal and the registre de commerce (the bank account is not here: see `invoicePaymentLine`).
 */
export function invoiceHeaderLines(settings: Pick<CompanySettings, 'companyName' | 'companyAddress' | 'matriculeFiscal' | 'registreCommerce' | 'companyPhone' | 'companyEmail'>): string[] {
  const clean = (value: string | null | undefined) => (value ?? '').trim();
  // The server writes a matricule in its normal form when it can; a text it cannot read stays as it was typed.
  const taxId = clean(settings.matriculeFiscal);
  const lines = [
    clean(settings.companyName),
    clean(settings.companyAddress),
    clean(settings.companyPhone) ? `Tél. : ${clean(settings.companyPhone)}` : '',
    clean(settings.companyEmail),
    taxId ? `MF : ${normalizeMatricule(taxId) ?? taxId}` : '',
    clean(settings.registreCommerce) ? `RC : ${clean(settings.registreCommerce)}` : '',
  ];

  return lines.filter((line) => line !== '');
}

/** The line of the bank account an invoice adds in its payment block, only while it still asks to be paid; empty without a RIB. */
export function invoicePaymentLine(settings: Pick<CompanySettings, 'rib' | 'companyName'>): string {
  const rib = (settings.rib ?? '').trim();
  const name = (settings.companyName ?? '').trim();

  return rib ? `Coordonnées bancaires - RIB : ${normalizeRib(rib) ?? rib}${name ? ` (${name})` : ''}` : '';
}
