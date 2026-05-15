import { PASSWORD_RULES } from "@/lib/password-policy";
import { cn } from "@/lib/utils";

type PasswordRequirementsHintProps = {
  className?: string;
  variant?: "auth" | "settings";
};

export function PasswordRequirementsHint({
  className,
  variant = "auth",
}: PasswordRequirementsHintProps) {
  return (
    <p
      className={cn(
        "text-xs leading-relaxed",
        variant === "auth" ? "text-white/55" : "text-muted-foreground",
        className,
      )}
    >
      Password must include{" "}
      {PASSWORD_RULES.map((rule) => rule.label.toLowerCase()).join(", ")}.
    </p>
  );
}
