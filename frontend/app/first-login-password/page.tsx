"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { ApiClient } from "@/lib/api-client";
import { isPasswordPolicyMet } from "@/lib/password-policy";
import { PasswordRequirementsHint } from "@/components/password-requirements-hint";
import { PasswordRequirementsChecklist } from "@/components/password-requirements-checklist";

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

  const passwordsMatch =
    newPassword === confirmPassword && confirmPassword.length > 0;

  const isPasswordValid = isPasswordPolicyMet(newPassword) && passwordsMatch;

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
      <div className="text-center space-y-5 sm:space-y-6 animate-[fadeIn_0.3s_ease]">
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/15 ring-8 ring-green-500/10 sm:h-24 sm:w-24">
            <CheckCircle2 className="h-10 w-10 text-green-400 sm:h-12 sm:w-12" />
          </div>
        </div>
        <div>
          <h2 className="mb-2 text-2xl font-bold text-white sm:mb-3 sm:text-3xl">
            Password Updated!
          </h2>
          <p className="text-sm leading-relaxed text-white/70 sm:text-base">
            Your password has been updated. You can now access the system.
          </p>
          <p className="mt-3 text-xs text-white/50 sm:mt-4 sm:text-sm">
            Redirecting you to your dashboard shortly...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 sm:mb-8">
        <h2 className="mb-2 text-2xl font-bold tracking-[-0.02em] text-white sm:text-[1.75rem] xl:text-[2rem]">
          Create new password
        </h2>
        <p className="text-sm text-white/60 sm:text-[0.95rem]">
          This is required before you can access the system.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full min-w-0 space-y-5 sm:space-y-6">
        {error && (
          <div className="error-banner flex w-full min-w-0 items-start gap-2.5 rounded-[10px] border border-red-400/40 bg-red-500/12 p-3 text-sm text-[#FCA5A5] animate-[fadeIn_0.3s_ease] sm:gap-3 sm:p-4 sm:text-[0.9rem]">
            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <p className="min-w-0 font-medium leading-snug">{error}</p>
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
          <PasswordRequirementsHint />
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

          <PasswordRequirementsChecklist
            password={newPassword}
            extraRules={[
              {
                id: "matches",
                label: "Passwords match",
                passed: passwordsMatch,
              },
            ]}
          />
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
    <div className="login-theme flex min-h-dvh flex-col lg:grid lg:h-dvh lg:max-h-dvh lg:grid-cols-[minmax(0,42%)_minmax(0,58%)] lg:overflow-hidden">
      <div className="relative hidden min-h-0 overflow-hidden border-r border-slate-200/20 bg-[var(--bg-left)] lg:flex lg:h-full">
        <div className="relative z-10 mx-auto flex h-full w-full max-w-xl flex-col items-center justify-start px-8 pt-16 pb-12 text-center xl:px-12 xl:pt-20 xl:pb-16">
          <Image
            src="/images/logo.png"
            alt="PSUT Logo"
            width={180}
            height={180}
            className="h-auto w-[min(40vw,9rem)] max-w-[180px] object-contain sm:w-36 lg:w-[180px]"
            priority
          />
          <h1 className="mt-6 text-balance text-3xl font-bold leading-tight text-[var(--text-primary)] sm:text-4xl xl:mt-8 xl:text-5xl">
            <span>Smart University</span>
            <br />
            <span className="bg-gradient-to-r from-[#1E54B7] via-[#2563EB] to-[#48CAE4] bg-clip-text text-transparent">
              First Login
            </span>
            <br />
            <span>Security Setup</span>
          </h1>
        </div>
        <div className="absolute inset-x-0 bottom-16 z-10 flex justify-center px-8 text-center xl:bottom-20 xl:px-12">
          <p className="max-w-sm text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
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

      <div className="relative flex min-h-dvh flex-1 flex-col overflow-x-hidden overflow-y-auto [background:radial-gradient(ellipse_at_30%_20%,#1E54B7_0%,#0D1B4B_45%,#091232_100%)] px-4 py-8 sm:px-6 sm:py-10 lg:min-h-0 lg:h-full lg:overflow-y-auto lg:px-8 lg:py-8 xl:px-12 xl:py-10">
        <div className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_70%_80%,rgba(0,180,216,0.12)_0%,transparent_60%),radial-gradient(circle_at_20%_60%,rgba(37,99,235,0.15)_0%,transparent_50%)]" />
        <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center lg:min-h-0 lg:justify-center">
          <div className="w-full min-w-0 py-1 sm:py-2 lg:py-4">
            <Suspense
              fallback={<div className="text-center text-sm text-white/60 sm:text-base">Loading...</div>}
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
