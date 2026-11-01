#!/usr/bin/env node

/**
 * Guard of the languages (P3-04): fails when French (or Arabic) text is left in the code of the app instead of the catalogue.
 *
 *   npm run check:i18n          (node scripts/check-i18n.mjs)
 *
 * It reads `app/`, `components/`, `services/`, `hooks/` and `constants/` (.ts and .tsx) and reports, as `file:line`, every string
 * literal, template text and JSX text that holds an accented French letter, a common French word, or Arabic letters. Every sentence the
 * user can read has to come from `t('app....')` (screens) or `message(locale, 'app....')` (services).
 *
 * What it ignores: comments, `console.*` calls, imports, paths and URLs, keys and identifiers (a word with no space), and the few
 * entries of ALLOWED below, each with its reason. No dependency: plain Node.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FOLDERS = ['app', 'components', 'services', 'hooks', 'constants'];

/** What may stay in the code. Each entry: the file, the exact text, and why. Keep this list short. */
export const ALLOWED = [
  {
    file: 'constants/brand.ts',
    text: 'Smart Dépannage',
    reason: 'the name of the product, written the same in both languages (an Arabic message may not hold Latin letters, so it is not in the catalogue)',
  },
  {
    file: 'services/mockData.ts',
    text: '*',
    reason: 'demonstration data that no screen imports (checked: nothing in app/, components/, hooks/ or services/ reads it); it is never shown',
  },
];

// ---------------------------------------------------------------------------------------------------------------------
// What counts as French
// ---------------------------------------------------------------------------------------------------------------------

const ACCENTED = /[àâäçéèêëîïôöùûüÿœæÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸŒÆ]/;
const ARABIC = /[\u0620-\u064A\u066E-\u06D3\u0750-\u077F]/;

/** Small words that only French uses in a sentence (the text must have a space, or be JSX text, which is always read as a sentence). */
const SENTENCE_WORDS = new Set(
  (
    'le la les un une des du de et ou au aux en ce cette ces mon ma mes votre vos vous nous pour avec sans dans sur par est sont pas plus ' +
    'oui non merci aucun aucune annuler valider envoyer fermer retour suivant enregistrer modifier supprimer confirmer chargement erreur ' +
    'bonjour bienvenue accueil devis encaissement technicien heure prix montant jour jours'
  ).split(' '),
);

/** Single words of a button or a title, written with a capital letter ("Annuler"); a lower-case word alone is a key, not text. */
const UI_WORDS = new Set(
  (
    'Annuler Valider Envoyer Fermer Retour Suivant Enregistrer Modifier Supprimer Confirmer Chargement Erreur Aucun Aucune Oui Non Merci ' +
    'Bonjour Accueil Profil Missions Gains Devis Encaissement Technicien Client Heure Prix Montant Statut Actualiser Réglages Position Continuer ' +
    'Connexion Déconnexion Terminer Accepter Refuser Appeler Itinéraire Documents Langue Français Arabe'
  ).split(' '),
);

/** Why this text looks like French (or Arabic), or null when it does not. */
export function whyFrench(text, inJsx = false) {
  const plain = text.trim();

  if (!/[A-Za-zÀ-ÿ\u0620-\u064A\u066E-\u06D3]/.test(plain)) return null;

  if (ARABIC.test(plain)) return 'Arabic letters';

  if (ACCENTED.test(plain)) return 'an accented French letter';

  if (inJsx || /\s/.test(plain)) {
    const word = plain
      .toLowerCase()
      .split(/[^a-zà-ÿ-]+/)
      .find((candidate) => SENTENCE_WORDS.has(candidate));

    if (word) return `the French word "${word}"`;
  }

  if (UI_WORDS.has(plain)) return `the French word "${plain}"`;

  return null;
}

/** True for what is not text: a path, a URL, a key, a class name, a color, a number. */
function isNotText(text, inJsx) {
  const plain = text.trim();

  if (inJsx) return false;

  if (/^(\/|\.\/|\.\.\/|@\/|https?:|mailto:|tel:|sms:|geo:|whatsapp:|[a-z][a-z0-9+.-]*:\/\/)/i.test(plain) && !/\s/.test(plain)) return true;

  return /^[\w.:/@#?=&%+*,;|!~$^()[\]{}<>-]+$/.test(plain) && !ACCENTED.test(plain) && !UI_WORDS.has(plain);
}

// ---------------------------------------------------------------------------------------------------------------------
// A small reader of TypeScript/TSX: finds the strings, the template texts and the JSX texts, without a parser
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Returns { texts: [{ text, line, kind }] } for a source. `kind` is 'string', 'template' or 'jsx'. Comments are dropped, and so are
 * the strings of imports and of `console.*` calls.
 */
export function readTexts(source) {
  const n = source.length;
  const texts = [];
  const blank = []; // the code with every comment and string emptied (quotes kept), to find the JSX texts
  let i = 0;
  let line = 1;

  const advance = (count, keep) => {
    for (let k = 0; k < count; k += 1) {
      const c = source[i];
      if (c === '\n') line += 1;
      blank.push(keep || c === '\n' ? c : ' ');
      i += 1;
    }
  };

  const lastCode = () => {
    for (let k = blank.length - 1; k >= 0; k -= 1) if (!/\s/.test(blank[k])) return blank[k];
    return '';
  };

  const statementSoFar = () => {
    let k = blank.length - 1;
    while (k >= 0 && !';{}'.includes(blank[k])) k -= 1;
    return blank.slice(k + 1).join('');
  };

  const importsOrLogs = () => {
    const before = statementSoFar();
    return /(^|\s)(import|export)\b[^=]*\bfrom\s*$/.test(before) || /(^|\s)import\s*$/.test(before) || /\b(require|import)\s*\(\s*$/.test(before) || /\bconsole\.\w+\s*\(/.test(before);
  };

  const regexAllowed = () => {
    const last = lastCode();
    if (last === '' || '(,=:[!&|?{;+-*%<>~^'.includes(last)) return true;
    return /\breturn\s*$/.test(blank.slice(-8).join(''));
  };

  function readString(quote) {
    const startLine = line;
    const startIndex = i;
    let text = '';
    let k = i + 1;

    while (k < n && source[k] !== quote) {
      if (source[k] === '\n') break;
      if (source[k] === '\\') {
        text += source.slice(k, k + 2);
        k += 2;
      } else {
        text += source[k];
        k += 1;
      }
    }

    // A quote that is never closed on its line is an apostrophe of JSX text, not a string.
    if (source[k] !== quote) {
      advance(1, true);
      return;
    }

    const skip = importsOrLogs();
    advance(1, true);
    advance(k - startIndex - 1, false);
    advance(1, true);

    if (!skip) texts.push({ text, line: startLine, kind: 'string' });
  }

  function readTemplate() {
    let text = '';
    let startLine = line;
    const skip = importsOrLogs();

    advance(1, true);

    while (i < n) {
      const c = source[i];

      if (c === '\\') {
        text += source.slice(i, i + 2);
        advance(2, false);
      } else if (c === '`') {
        advance(1, true);
        if (!skip) texts.push({ text, line: startLine, kind: 'template' });
        return;
      } else if (c === '$' && source[i + 1] === '{') {
        if (!skip) texts.push({ text, line: startLine, kind: 'template' });
        text = '';
        advance(2, true);
        readCode(true);
        startLine = line;
      } else {
        text += c;
        advance(1, false);
      }
    }
  }

  function readRegex() {
    let inClass = false;
    advance(1, false);

    while (i < n && source[i] !== '\n') {
      const c = source[i];
      if (c === '\\') {
        advance(2, false);
        continue;
      }
      if (c === '[') inClass = true;
      if (c === ']') inClass = false;
      if (c === '/' && !inClass) {
        advance(1, false);
        while (/[a-z]/.test(source[i] ?? '')) advance(1, false);
        return;
      }
      advance(1, false);
    }
  }

  function readCode(inTemplate) {
    let depth = 0;

    while (i < n) {
      const c = source[i];
      const next = source[i + 1];

      if (c === '/' && next === '/') {
        while (i < n && source[i] !== '\n') advance(1, false);
      } else if (c === '/' && next === '*') {
        advance(2, false);
        while (i < n && !(source[i] === '*' && source[i + 1] === '/')) advance(1, false);
        advance(2, false);
      } else if (c === "'" || c === '"') {
        readString(c);
      } else if (c === '`') {
        readTemplate();
      } else if (c === '/' && regexAllowed() && next !== '>') {
        readRegex();
      } else if (c === '{') {
        depth += 1;
        advance(1, true);
      } else if (c === '}') {
        if (inTemplate && depth === 0) {
          advance(1, true);
          return;
        }
        depth -= 1;
        advance(1, true);
      } else {
        advance(1, true);
      }
    }
  }

  readCode(false);

  // JSX text: what sits between a ">" and the next "<" of the emptied code, without the {expressions}.
  const code = blank.join('');
  const between = /(.)>([^<>]*)</g;
  let found;

  while ((found = between.exec(code)) !== null) {
    // The "<" ends the text but is also the start of the next element: look again from there.
    between.lastIndex = found.index + found[0].length - 1;

    // "=>" is an arrow function, not the end of a tag.
    if (found[1] === '=') continue;

    let inner = found[2];
    let before = '';

    while (before !== inner) {
      before = inner;
      inner = inner.replace(/\{[^{}]*\}/g, ' ');
    }

    if (!/[A-Za-zÀ-ÿ\u0620-\u064A\u066E-\u06D3]/.test(inner) || /[;=]/.test(inner)) continue;

    const start = found.index + 2 + found[2].search(/\S|$/);

    texts.push({ text: inner, line: code.slice(0, start).split('\n').length, kind: 'jsx' });
  }

  return { texts };
}

/** The problems of one source: [{ line, text, why }]. `file` is relative to the app folder, with "/" separators. */
export function problemsOf(file, source) {
  const allowed = ALLOWED.filter((entry) => entry.file === file);

  if (allowed.some((entry) => entry.text === '*')) return [];

  const problems = [];

  for (const { text, line, kind } of readTexts(source).texts) {
    if (isNotText(text, kind === 'jsx')) continue;

    const why = whyFrench(text, kind === 'jsx');

    if (!why) continue;
    if (allowed.some((entry) => entry.text === text.trim())) continue;

    problems.push({ line, text: text.trim().replace(/\s+/g, ' '), why });
  }

  return problems.sort((a, b) => a.line - b.line);
}

// ---------------------------------------------------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------------------------------------------------

function filesOf(folder) {
  const found = [];

  const walk = (directory) => {
    let entries;

    try {
      entries = readdirSync(directory);
    } catch {
      return;
    }

    for (const name of entries.sort()) {
      if (name === 'node_modules' || name.startsWith('.')) continue;

      const path = join(directory, name);

      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(name) && !name.endsWith('.d.ts')) found.push(path);
    }
  };

  walk(join(ROOT, folder));

  return found;
}

function main() {
  const files = FOLDERS.flatMap(filesOf);
  let count = 0;

  for (const path of files) {
    const file = relative(ROOT, path).split(sep).join('/');

    for (const problem of problemsOf(file, readFileSync(path, 'utf8'))) {
      count += 1;
      console.log(`${file}:${problem.line}  "${problem.text}"  (${problem.why})`);
    }
  }

  if (count) {
    console.log(`\ncheck:i18n failed: ${count} text(s) in the code. Move each into src/i18n/{fr,ar}/app.ts of smart-depannage-shared and read it with t('app....').`);
    process.exit(1);
  }

  console.log(`check:i18n ok: ${files.length} files read, no French or Arabic text left in the code.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
