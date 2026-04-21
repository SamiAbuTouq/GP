"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Lock,
  CheckCircle2,
  ArrowLeft,
  XCircle,
  Check,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INPUT_BASE_CLASSES =
  "h-12 rounded-[10px] border px-4 text-white placeholder:text-white/45 backdrop-blur-[4px] transition-all duration-300 ease-out focus:outline-none focus:bg-white/[0.14] focus:border-[#48CAE4] focus:shadow-[0_0_0_3px_rgba(72,202,228,0.18)] bg-white/[0.08] border-white/[0.18]";

function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [apiError, setApiError] = useState("");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const router = useRouter();

  const rules = [
    { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
    { label: "One uppercase letter (A-Z)", test: (p: string) => /[A-Z]/.test(p) },
    { label: "One lowercase letter (a-z)", test: (p: string) => /[a-z]/.test(p) },
    { label: "One number (0-9)", test: (p: string) => /\d/.test(p) },
    { label: "One special character (@$!%*?&)", test: (p: string) => /[@$!%*?&]/.test(p) },
  ];

  const passwordValid = rules.every((r) => r.test(password));

  useEffect(() => {
    if (!isSuccess) return;
    const t = setTimeout(() => router.push("/login"), 3000);
    return () => clearTimeout(t);
  }, [isSuccess, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError("");
    setConfirmError("");

    if (!passwordValid) return;

    if (password !== confirmPassword) {
      setConfirmError("Passwords do not match.");
      return;
    }

    if (!token) {
      setApiError("Invalid or missing reset token. Please request a new password reset link.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
      } else {
        setApiError(data.error || "Failed to reset password. Please try again.");
      }
    } catch (error) {
      console.error("Error resetting password:", error);
      setApiError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-green-100 dark:bg-green-950/50 rounded-full flex items-center justify-center ring-8 ring-green-50 dark:ring-green-950/20">
            <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-white mb-3">
            Password Updated!
          </h2>
          <p className="text-slate-200 leading-relaxed">
            Your password has been successfully reset. You can now sign in with your new credentials.
          </p>
          <p className="text-slate-300 text-sm mt-4">
            Redirecting you to sign in shortly...
          </p>
        </div>
        <Button
          asChild
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base rounded-xl shadow-lg shadow-blue-600/25 transition-all hover:shadow-xl hover:shadow-blue-600/30"
        >
          <Link href="/login" className="flex items-center justify-center gap-2">
            Go to Sign In Now
          </Link>
        </Button>
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
          Choose a strong password to secure your account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* API-level error */}
        {apiError && (
          <div className="flex items-start gap-3 p-4 rounded-xl border bg-red-50 border-red-200 text-red-600 dark:bg-red-950/50 dark:border-red-800 dark:text-red-400 text-sm">
            <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="font-medium">{apiError}</p>
          </div>
        )}

        {/* Password field */}
        <div className="form-field space-y-2">
          <Label
            htmlFor="password"
            className="text-[0.875rem] font-medium tracking-[0.01em] text-white/85"
          >
            New Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className={`${INPUT_BASE_CLASSES} pr-12 ${
                password.length > 0 && !passwordValid
                  ? "border-[#EF4444] shadow-[0_0_0_3px_rgba(239,68,68,0.2)]"
                  : passwordValid
                    ? "border-[#10B981] shadow-[0_0_0_3px_rgba(16,185,129,0.18)]"
                    : ""
              }`}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 transition-colors hover:text-white"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

        </div>

        {/* Confirm password field */}
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
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (confirmError) setConfirmError("");
              }}
              autoComplete="new-password"
              className={`${INPUT_BASE_CLASSES} pr-12 ${
                confirmError
                  ? "border-[#EF4444] shadow-[0_0_0_3px_rgba(239,68,68,0.2)] animate-[shake_0.4s_ease]"
                  : confirmPassword && password === confirmPassword
                    ? "border-[#10B981] shadow-[0_0_0_3px_rgba(16,185,129,0.18)]"
                    : ""
              }`}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 transition-colors hover:text-white"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {confirmError && (
            <p className="mt-1 flex animate-[fadeIn_0.3s_ease] items-center gap-1.5 text-[0.78rem] text-[#FCA5A5]">
              <XCircle className="w-3.5 h-3.5 shrink-0" />
              {confirmError}
            </p>
          )}

          {/* Live password strength checklist */}
          {password.length > 0 && (
            <ul className="mt-3 grid grid-cols-1 gap-1.5 p-3 bg-white/10 rounded-xl border border-white/20">
              {rules.map((rule) => {
                const passed = rule.test(password);
                return (
                  <li
                    key={rule.label}
                    className={`flex items-center gap-2 text-xs font-medium transition-colors ${
                      passed
                        ? "text-green-300"
                        : "text-slate-300"
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
          disabled={isLoading || !token || !passwordValid}
          className="sign-in-btn h-12 w-full rounded-xl bg-[linear-gradient(135deg,#2563EB_0%,#1E54B7_100%)] text-base font-semibold text-white transition-[transform,box-shadow] duration-150 hover:-translate-y-[1px] hover:shadow-[0_6px_20px_rgba(37,99,235,0.4)] active:translate-y-0 active:shadow-none disabled:pointer-events-none disabled:opacity-75"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Updating...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Lock className="w-5 h-5" />
              Reset Password
            </span>
          )}
        </Button>

        <div className="text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#48CAE4] transition-colors hover:text-[#90E0EF]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sign In
          </Link>
        </div>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="reset-theme min-h-screen lg:grid lg:grid-cols-[42%_58%]">
      <div className="relative hidden lg:flex overflow-hidden border-r border-slate-200/20 bg-[var(--bg-left)]">
        <div className="relative z-10 mx-auto flex h-full w-full max-w-xl flex-col items-center justify-start px-12 pt-20 pb-16 text-center">
          <div className="flex justify-center">
            <Image
              src="/images/logo.png"
              alt="PSUT Logo"
              width={180}
              height={180}
              className="object-contain"
              priority
            />
          </div>
          <h1 className="mt-8 text-5xl font-bold leading-tight text-[var(--text-primary)]">
            <span className="bg-gradient-to-r from-[#1E54B7] via-[#2563EB] to-[#48CAE4] bg-clip-text text-transparent">
              Password
            </span>
            <br />
            Reset
          </h1>
        </div>
        <div className="absolute inset-x-0 bottom-20 z-10 flex justify-center px-12 text-center">
          <div className="w-full max-w-xl">
            <p className="text-base leading-relaxed text-[var(--text-secondary)]">
              Create a strong new password to keep your account safe and regain access.
            </p>
            <div className="mt-6 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
              <p className="whitespace-nowrap text-sm leading-relaxed text-slate-600 dark:text-white/70">
                <span className="font-medium text-slate-800 dark:text-white">Security tip:</span> Use a unique password that you do not use anywhere else.
              </p>
            </div>
          </div>
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
            <Suspense fallback={<div className="text-center text-slate-300">Loading...</div>}>
              <ResetPasswordForm />
            </Suspense>

            <p className="mt-8 text-center text-[0.85rem] text-white/50">
              Need help?{" "}
              <Link
                href="/help"
                className="font-medium text-[#48CAE4] transition-colors hover:text-[#90E0EF]"
              >
                Contact IT Support
              </Link>
            </p>
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
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          20% {
            transform: translateX(-6px);
          }
          40% {
            transform: translateX(6px);
          }
          60% {
            transform: translateX(-4px);
          }
          80% {
            transform: translateX(4px);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
