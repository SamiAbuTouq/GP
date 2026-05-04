"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { ApiClient } from "@/lib/api-client";

const INPUT_BASE_CLASSES =
  "form-input h-12 w-full rounded-[10px] border-[1.5px] border-white/20 bg-white/10 px-4 pr-12 text-[0.95rem] text-white placeholder:text-white/40 backdrop-blur-[4px] transition-all duration-[250ms] ease-out focus:bg-white/15 focus:border-[#48CAE4] focus:shadow-[0_0_0_3px_rgba(72,202,228,0.18)] focus:outline-none";

function FirstLoginPasswordForm() {
  const router = useRouter();
  const { user, authLoading } = useAuth();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState({
    next: false,
    confirm: false,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!user.requiresPasswordChange) {
      router.replace("/dashboard");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!isSuccess) return;
    const t = setTimeout(() => router.replace("/dashboard"), 1200);
    return () => clearTimeout(t);
  }, [isSuccess, router]);

  const passwordChecks = useMemo(
    () => ({
      minLength: newPassword.length >= 8,
      hasUppercase: /[A-Z]/.test(newPassword),
      hasLowercase: /[a-z]/.test(newPassword),
      hasNumber: /\d/.test(newPassword),
      hasSpecial: /[@$!%*?&]/.test(newPassword),
      matches: newPassword === confirmPassword && confirmPassword.length > 0,
    }),
    [newPassword, confirmPassword],
  );

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!user?.id) {
      setError("Your session is invalid. Please sign in again.");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (!isPasswordValid) {
      setError("Please make sure your new password meets all requirements.");
      return;
    }

    setIsLoading(true);
    try {
      await ApiClient.updateMyPassword(newPassword);

      // Pull a fresh token so requires_password_change becomes false in auth state.
      await ApiClient.refresh();
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="text-center space-y-6 animate-[fadeIn_0.3s_ease]">
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full flex items-center justify-center ring-8 ring-green-500/10 bg-green-500/15">
            <CheckCircle2 className="w-12 h-12 text-green-400" />
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-white mb-3">
            Password Updated!
          </h2>
          <p className="text-white/70 leading-relaxed">
            Your password has been updated. You can now access the system.
          </p>
          <p className="text-white/50 text-sm mt-4">
            Redirecting you to your dashboard shortly...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="mb-2 text-[2rem] font-bold tracking-[-0.02em] text-white">
          Create new password
        </h2>
        <p className="text-[0.95rem] text-white/60">
          This is required before you can access the system.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="error-banner flex items-start gap-3 rounded-[10px] border border-red-400/40 bg-red-500/12 p-4 text-[0.9rem] text-[#FCA5A5] animate-[fadeIn_0.3s_ease]">
            <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        <div className="form-field space-y-2">
          <Label
            htmlFor="newPassword"
            className="text-[0.875rem] font-medium tracking-[0.01em] text-white/85"
          >
            New Password
          </Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={show.next ? "text" : "password"}
              placeholder="Enter your new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={INPUT_BASE_CLASSES}
              required
            />
            <button
              type="button"
              onClick={() => setShow((s) => ({ ...s, next: !s.next }))}
              className="field-icon absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-white/50 transition-all duration-200 hover:text-white/90"
              aria-label={show.next ? "Hide password" : "Show password"}
            >
              {show.next ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        <div className="form-field space-y-2">
          <Label
            htmlFor="confirmPassword"
            className="text-[0.875rem] font-medium tracking-[0.01em] text-white/85"
          >
            Confirm Password
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={show.confirm ? "text" : "password"}
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={INPUT_BASE_CLASSES}
              required
            />
            <button
              type="button"
              onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
              className="field-icon absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-white/50 transition-all duration-200 hover:text-white/90"
              aria-label={show.confirm ? "Hide password" : "Show password"}
            >
              {show.confirm ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>

          {newPassword.length > 0 && (
            <ul className="mt-3 grid grid-cols-1 gap-1.5 rounded-[10px] border border-white/15 bg-white/5 p-3 backdrop-blur-[2px]">
              {[
                { key: "minLength", label: "At least 8 characters" },
                { key: "hasUppercase", label: "One uppercase letter (A-Z)" },
                { key: "hasLowercase", label: "One lowercase letter (a-z)" },
                { key: "hasNumber", label: "One number (0-9)" },
                { key: "hasSpecial", label: "One special character (@$!%*?&)" },
                { key: "matches", label: "Passwords match" },
              ].map((rule) => {
                const passed =
                  passwordChecks[rule.key as keyof typeof passwordChecks];
                return (
                  <li
                    key={rule.key}
                    className={`flex items-center gap-2 text-xs font-medium transition-colors ${
                      passed
                        ? "text-[#86EFAC]"
                        : "text-white/45"
                    }`}
                  >
                    {passed ? (
                      <Check className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <X className="w-3.5 h-3.5 shrink-0" />
                    )}
                    {rule.label}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <Button
          type="submit"
          disabled={isLoading || !isPasswordValid}
          className="sign-in-btn h-12 w-full rounded-xl bg-[linear-gradient(135deg,#2563EB_0%,#1E54B7_100%)] text-base font-semibold text-white transition-[transform,box-shadow] duration-150 hover:-translate-y-[1px] hover:shadow-[0_6px_20px_rgba(37,99,235,0.4)] active:translate-y-0 active:shadow-none disabled:pointer-events-none disabled:opacity-75"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Updating...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Lock className="w-5 h-5" />
              Set Password
            </span>
          )}
        </Button>
      </form>
    </>
  );
}

export default function FirstLoginPasswordPage() {
  return (
    <div className="login-theme min-h-screen lg:grid lg:grid-cols-[42%_58%]">
      <div className="relative hidden lg:flex overflow-hidden border-r border-slate-200/20 bg-[var(--bg-left)]">
        <div className="relative z-10 mx-auto flex h-full w-full max-w-xl flex-col items-center justify-start px-12 pt-20 pb-16 text-center">
          <Image
            src="/images/logo.png"
            alt="PSUT Logo"
            width={180}
            height={180}
            className="object-contain"
            priority
          />
          <h1 className="mt-8 text-5xl font-bold leading-tight text-[var(--text-primary)]">
            <span>Smart University</span>
            <br />
            <span className="bg-gradient-to-r from-[#1E54B7] via-[#2563EB] to-[#48CAE4] bg-clip-text text-transparent">
              First Login
            </span>
            <br />
            <span>Security Setup</span>
          </h1>
        </div>
        <div className="absolute inset-x-0 bottom-20 z-10 flex justify-center px-12 text-center">
          <p className="max-w-sm text-base leading-relaxed text-[var(--text-secondary)]">
            For security, set a strong password before you access your dashboard.
          </p>
        </div>
        <div
          className="absolute inset-x-0 bottom-0 h-19 bg-bottom bg-repeat-x opacity-90"
          style={{
            backgroundImage: "url('/images/background/(1).jpeg')",
            backgroundSize: "auto 100%",
            filter: "var(--mosaic-filter)",
          }}
        />
      </div>

      <div className="relative overflow-hidden p-6 lg:p-12 [background:radial-gradient(ellipse_at_30%_20%,#1E54B7_0%,#0D1B4B_45%,#091232_100%)]">
        <div className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_70%_80%,rgba(0,180,216,0.12)_0%,transparent_60%),radial-gradient(circle_at_20%_60%,rgba(37,99,235,0.15)_0%,transparent_50%)]" />
        <div className="relative mx-auto flex min-h-screen w-full max-w-md items-center py-10 lg:min-h-0">
          <div className="w-full py-4 lg:py-8">
            <Suspense
              fallback={<div className="text-center text-white/60">Loading...</div>}
            >
              <FirstLoginPasswordForm />
            </Suspense>
          </div>
        </div>
      </div>
      <style jsx global>{`
        :root {
          --bg-left: #ffffff;
          --text-primary: #0d1b4b;
          --text-secondary: #4b5563;
          --mosaic-filter: none;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --bg-left: #0a1128;
            --text-primary: #ffffff;
            --text-secondary: rgba(255, 255, 255, 0.6);
            --mosaic-filter: invert(1) hue-rotate(180deg) saturate(1.5);
          }
        }
        .form-field {
          animation: slideUpFade 0.5s ease both;
        }
        .form-field:nth-of-type(1) {
          animation-delay: 0.1s;
        }
        .form-field:nth-of-type(2) {
          animation-delay: 0.25s;
        }
        .sign-in-btn {
          animation: slideUpFade 0.5s ease 0.4s both;
        }
        .field-icon:hover {
          opacity: 1;
        }
        .error-banner svg {
          color: #fca5a5;
        }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px rgba(255, 255, 255, 0.1) inset !important;
          box-shadow: 0 0 0 1000px rgba(255, 255, 255, 0.1) inset !important;
          -webkit-text-fill-color: #ffffff !important;
          color: #ffffff !important;
          border-color: rgba(255, 255, 255, 0.2) !important;
          transition: background-color 5000s ease-in-out 0s;
        }
        input:-webkit-autofill:focus {
          -webkit-box-shadow:
            0 0 0 1000px rgba(255, 255, 255, 0.15) inset,
            0 0 0 3px rgba(72, 202, 228, 0.18) !important;
          box-shadow:
            0 0 0 1000px rgba(255, 255, 255, 0.15) inset,
            0 0 0 3px rgba(72, 202, 228, 0.18) !important;
          border-color: #48cae4 !important;
        }
        @keyframes slideUpFade {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
