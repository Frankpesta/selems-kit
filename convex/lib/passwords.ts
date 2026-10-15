// Staff password policy (docs/04): at least 10 characters, not a common password.
// TODO(stage 4): replace COMMON with the 10k most common passwords list.

export const MIN_PASSWORD_LENGTH = 10;

const COMMON = new Set([
  "0123456789", "1234567890", "12345678910", "0987654321", "1111111111", "1q2w3e4r5t",
  "1qaz2wsx3edc", "abcdefghij", "abc1234567", "iloveyou12", "password12", "password123",
  "password1234", "passw0rd123", "qwertyuiop", "qwerty1234", "qwerty12345", "asdfghjkl1",
  "zaq12wsxcde", "welcome123", "letmein123", "admin12345", "administrator", "selems1234",
  "selemshotel", "selems12345", "hotel12345", "nigeria123", "akure12345",
]);

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (COMMON.has(password.toLowerCase())) return "That password is too common. Choose another.";
  return null;
}
