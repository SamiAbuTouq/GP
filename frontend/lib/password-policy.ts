export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_SPECIAL_CHAR_PATTERN = /[@$!%*?&]/;

export const PASSWORD_RULES = [
  {
    id: "minLength",
    label: "At least 8 characters",
    test: (password: string) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "hasUppercase",
    label: "One uppercase letter (A–Z)",
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    id: "hasNumber",
    label: "One number (0–9)",
    test: (password: string) => /\d/.test(password),
  },
  {
    id: "hasSpecial",
    label: "One special character (@$!%*?&)",
    test: (password: string) => PASSWORD_SPECIAL_CHAR_PATTERN.test(password),
  },
] as const;

export type PasswordRuleId = (typeof PASSWORD_RULES)[number]["id"];

export function evaluatePasswordRules(
  password: string,
): Record<PasswordRuleId, boolean> {
  return PASSWORD_RULES.reduce(
    (checks, rule) => {
      checks[rule.id] = rule.test(password);
      return checks;
    },
    {} as Record<PasswordRuleId, boolean>,
  );
}

export function isPasswordPolicyMet(password: string): boolean {
  return validatePassword(password) === null;
}

export function validatePassword(value: string): string | null {
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`;
  }
  if (!/[A-Z]/.test(value)) {
    return "Password must contain at least one uppercase letter";
  }
  if (!/\d/.test(value)) {
    return "Password must contain at least one number";
  }
  if (!PASSWORD_SPECIAL_CHAR_PATTERN.test(value)) {
    return "Password must contain at least one special character (@$!%*?&)";
  }
  return null;
}
