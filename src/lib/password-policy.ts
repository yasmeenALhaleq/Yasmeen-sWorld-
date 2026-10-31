// Password rules, shared by the browser (live hints) and the server (enforcement).

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_BYTES = 72; // bcrypt ignores everything after 72 bytes

/** Returns an error message, or null when the password is acceptable. */
export function passwordProblem(password: string, email?: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return "That password is too long (72 bytes maximum).";
  if (!/[A-Za-z؀-ۿ]/.test(password) || !/\d/.test(password)) return "Include at least one letter and one number.";
  if (email && password.toLowerCase().includes(email.toLowerCase().split("@")[0]) && email.split("@")[0].length >= 4) {
    return "The password should not contain your email name.";
  }
  if (/^(.)\1+$/.test(password)) return "That password is too easy to guess.";
  return null;
}
