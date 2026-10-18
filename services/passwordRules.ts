/**
 * The rules a new password must follow: the same three as the server's change-password route
 * (at least 8 characters, an upper-case letter, a digit). The server decides; this lets the
 * screen say what is missing before the request is sent.
 */
export const PASSWORD_MIN_LENGTH = 8;

/** What is missing from the password, one sentence each; empty when it is acceptable. */
export function passwordProblems(password: string): string[] {
  const problems: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    problems.push(`Au moins ${PASSWORD_MIN_LENGTH} caractères.`);
  }

  if (!/[A-Z]/.test(password)) problems.push('Au moins une majuscule.');
  if (!/[0-9]/.test(password)) problems.push('Au moins un chiffre.');

  return problems;
}

/** The first thing wrong with the three fields of the change-password form, or null. */
export function changePasswordIssue(current: string, next: string, confirm: string): string | null {
  if (!current) return 'Entrez votre mot de passe actuel.';

  const problems = passwordProblems(next);

  if (problems.length) return `Nouveau mot de passe : ${problems.join(' ')}`;
  if (next === current) return 'Le nouveau mot de passe doit être différent de l’actuel.';
  if (next !== confirm) return 'La confirmation ne correspond pas au nouveau mot de passe.';

  return null;
}
