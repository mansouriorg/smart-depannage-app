import { message, type Locale } from '../lib/shared';

/**
 * The rules a new password must follow: the same three as the server's change-password route
 * (at least 8 characters, an upper-case letter, a digit). The server decides; this lets the
 * screen say what is missing before the request is sent.
 */
export const PASSWORD_MIN_LENGTH = 8;

/** What is missing from the password, one sentence each; empty when it is acceptable. */
export function passwordProblems(password: string, locale: Locale): string[] {
  const problems: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    problems.push(message(locale, 'app.passwordRules.minLength', { count: PASSWORD_MIN_LENGTH }));
  }

  if (!/[A-Z]/.test(password)) problems.push(message(locale, 'app.passwordRules.upper'));
  if (!/[0-9]/.test(password)) problems.push(message(locale, 'app.passwordRules.digit'));

  return problems;
}

/** The first thing wrong with the three fields of the change-password form, or null. */
export function changePasswordIssue(current: string, next: string, confirm: string, locale: Locale): string | null {
  if (!current) return message(locale, 'app.passwordRules.askCurrent');

  const problems = passwordProblems(next, locale);

  if (problems.length) return message(locale, 'app.passwordRules.newProblems', { problems: problems.join(' ') });
  if (next === current) return message(locale, 'app.passwordRules.same');
  if (next !== confirm) return message(locale, 'app.passwordRules.mismatch');

  return null;
}
