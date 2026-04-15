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
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-green-100 dark:bg-green-950/50 rounded-full flex items-center justify-center ring-8 ring-green-50 dark:ring-green-950/20">
            <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
            Password Updated!
          </h2>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
            Your password has been updated. You can now access the system.
          </p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-4">
            Redirecting you to your dashboard shortly...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
          Create new password
        </h2>
        <p className="text-slate-500 dark:text-slate-400">
          This is required before you can access the system.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl border bg-red-50 border-red-200 text-red-600 dark:bg-red-950/50 dark:border-red-800 dark:text-red-400 text-sm">
            <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        <div className="space-y-2">
          <Label
            htmlFor="newPassword"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
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
              className="h-12 pl-4 pr-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 focus:ring-blue-500/20 transition-all"
              required
            />
            <button
              type="button"
              onClick={() => setShow((s) => ({ ...s, next: !s.next }))}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
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

        <div className="space-y-2">
          <Label
            htmlFor="confirmPassword"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
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
              className="h-12 pl-4 pr-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 focus:ring-blue-500/20 transition-all"
              required
            />
            <button
              type="button"
              onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
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
            <ul className="mt-3 grid grid-cols-1 gap-1.5 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
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
                        ? "text-green-600 dark:text-green-400"
                        : "text-slate-400 dark:text-slate-500"
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
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base rounded-xl shadow-lg shadow-blue-600/25 transition-all hover:shadow-xl hover:shadow-blue-600/30 disabled:opacity-70 disabled:cursor-not-allowed"
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
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-950">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#0a1628] relative overflow-hidden order-first">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />

        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between h-full w-full p-10 xl:p-14">
          <div className="flex justify-center pt-8">
            <Image
              src="/images/logo.png"
              alt="PSUT Logo"
              width={200}
              height={200}
              className="object-contain drop-shadow-2xl"
              priority
            />
          </div>

          <div className="flex-1 flex flex-col justify-center items-center text-center">
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-6">
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                First
              </span>
              <br />
              <span className="text-white">Login</span>
            </h1>
            <p className="text-slate-400 text-lg max-w-sm leading-relaxed">
              For security, you must set a new password before using the system.
            </p>
          </div>

          <div className="pb-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-slate-400 text-sm leading-relaxed">
                <span className="text-slate-300 font-medium">Security tip:</span>{" "}
                Use a unique password that you don&apos;t use anywhere else.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-white dark:bg-slate-900 order-last">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex justify-center mb-8">
            <Image
              src="/images/logo.png"
              alt="PSUT Logo"
              width={120}
              height={120}
              className="object-contain"
              priority
            />
          </div>

          <Suspense
            fallback={<div className="text-center text-slate-400">Loading...</div>}
          >
            <FirstLoginPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
