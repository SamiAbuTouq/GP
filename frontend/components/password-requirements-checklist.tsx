import { Check, X } from "lucide-react";
import {
  PASSWORD_RULES,
  type PasswordRuleId,
} from "@/lib/password-policy";
import { cn } from "@/lib/utils";

type PasswordRequirementsChecklistProps = {
  password: string;
  className?: string;
  variant?: "auth" | "settings";
  extraRules?: Array<{ id: string; label: string; passed: boolean }>;
};

export function PasswordRequirementsChecklist({
  password,
  className,
  variant = "auth",
  extraRules = [],
}: PasswordRequirementsChecklistProps) {
  if (password.length === 0 && extraRules.length === 0) {
    return null;
  }

  const checks = PASSWORD_RULES.map((rule) => ({
    key: rule.id,
    label: rule.label,
    passed: rule.test(password),
  }));

  const allRules = [
    ...checks,
    ...extraRules.map((rule) => ({
      key: rule.id,
      label: rule.label,
      passed: rule.passed,
    })),
  ];

  return (
    <ul
      className={cn(
        "mt-3 grid grid-cols-1 gap-1.5 rounded-[10px] border p-3",
        variant === "auth"
          ? "border-white/15 bg-white/5 backdrop-blur-[2px]"
          : "border-border bg-muted/30",
        className,
      )}
    >
      {allRules.map((rule) => (
        <li
          key={rule.key}
          className={cn(
            "flex items-center gap-2 text-xs font-medium transition-colors",
            rule.passed
              ? variant === "auth"
                ? "text-[#86EFAC]"
                : "text-emerald-600 dark:text-emerald-400"
              : variant === "auth"
                ? "text-white/45"
                : "text-muted-foreground",
          )}
        >
          {rule.passed ? (
            <Check className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <X className="h-3.5 w-3.5 shrink-0" />
          )}
          {rule.label}
        </li>
      ))}
    </ul>
  );
}

export function passwordRulesMet(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

export type { PasswordRuleId };
