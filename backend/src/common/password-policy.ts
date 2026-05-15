export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_UPPERCASE_PATTERN = /[A-Z]/;
export const PASSWORD_NUMBER_PATTERN = /\d/;
export const PASSWORD_SPECIAL_CHAR_PATTERN = /[@$!%*?&]/;

export function validatePassword(value: string): string | null {
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`;
  }
  if (!PASSWORD_UPPERCASE_PATTERN.test(value)) {
    return "Password must contain at least one uppercase letter";
  }
  if (!PASSWORD_NUMBER_PATTERN.test(value)) {
    return "Password must contain at least one number";
  }
  if (!PASSWORD_SPECIAL_CHAR_PATTERN.test(value)) {
    return "Password must contain at least one special character (@$!%*?&)";
  }
  return null;
}
