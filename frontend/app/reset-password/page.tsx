"use client";

import { useState, Suspense } from "react";
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
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    setTimeout(() => {
      router.push("/login");
    }, 3000);

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
            Your password has been successfully reset. You can now sign in with your new credentials.
          </p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-4">
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
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
          Create new password
        </h2>
        <p className="text-slate-500 dark:text-slate-400">
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
        <div className="space-y-2">
          <Label
            htmlFor="password"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
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
              className="h-12 pl-4 pr-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 focus:ring-blue-500/20 transition-all"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

        </div>

        {/* Confirm password field */}
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
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (confirmError) setConfirmError("");
              }}
              className={`h-12 pl-4 pr-12 bg-slate-50 dark:bg-slate-800 rounded-xl transition-all ${
                confirmError
                  ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
                  : "border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20"
              }`}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {confirmError && (
            <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 mt-1">
              <XCircle className="w-3.5 h-3.5 shrink-0" />
              {confirmError}
            </p>
          )}

          {/* Live password strength checklist */}
          {password.length > 0 && (
            <ul className="mt-3 grid grid-cols-1 gap-1.5 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
              {rules.map((rule) => {
                const passed = rule.test(password);
                return (
                  <li
                    key={rule.label}
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
          disabled={isLoading || !token || !passwordValid}
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base rounded-xl shadow-lg shadow-blue-600/25 transition-all hover:shadow-xl hover:shadow-blue-600/30 disabled:opacity-70 disabled:cursor-not-allowed"
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
            className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
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
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-950">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#0a1628] relative overflow-hidden order-first">
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Gradient glow effects */}
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between h-full w-full p-10 xl:p-14">
          {/* Logo */}
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

          {/* Main Content */}
          <div className="flex-1 flex flex-col justify-center items-center text-center">
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-6">
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Password
              </span>
              <br />
              <span className="text-white">Reset</span>
            </h1>
            <p className="text-slate-400 text-lg max-w-sm leading-relaxed">
              Create a strong new password to keep your account safe and regain access.
            </p>
          </div>

          {/* Security tip at bottom */}
          <div className="pb-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-slate-400 text-sm leading-relaxed">
              <span className="text-slate-300 font-medium">Security tip:</span> Use a unique password that you don't use anywhere else.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-white dark:bg-slate-900 order-last">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
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

          <Suspense fallback={<div className="text-center text-slate-400">Loading...</div>}>
            <ResetPasswordForm />
          </Suspense>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-8">
            Need help?{" "}
            <Link
              href="/help"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
            >
              Contact IT Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
