"use client";

import type React from "react";
import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  WifiOff,
  ServerCrash,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClient, ApiError } from "@/lib/api-client";

interface ErrorState {
  message: string;
  type: "credentials" | "network" | "server" | "validation" | "unknown";
}

const INPUT_BASE_CLASSES =
  "form-input h-12 w-full rounded-[10px] border-[1.5px] border-white/20 bg-white/10 px-4 pr-12 text-[0.95rem] text-white placeholder:text-white/40 backdrop-blur-[4px] transition-all duration-[250ms] ease-out focus:bg-white/15 focus:border-[#48CAE4] focus:shadow-[0_0_0_3px_rgba(72,202,228,0.18)] focus:outline-none";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [shakeField, setShakeField] = useState<"email" | "password" | null>(null);

  const validateEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  const validatePassword = (value: string) => value.length >= 6;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTouched({ email: true, password: true });

    if (!email.trim()) {
      setError({
        message: "Email address is required.",
        type: "validation",
      });
      setShakeField("email");
      return;
    }

    if (!validateEmail(email)) {
      setError({
        message: "Please enter a valid email address.",
        type: "validation",
      });
      setShakeField("email");
      return;
    }

    if (!password) {
      setError({
        message: "Password is required.",
        type: "validation",
      });
      setShakeField("password");
      return;
    }

    if (!validatePassword(password)) {
      setError({
        message: "Password must be at least 6 characters.",
        type: "validation",
      });
      setShakeField("password");
      return;
    }

    setIsLoading(true);

    try {
      const loginResponse = await ApiClient.login(email.trim(), password);
      const redirectTo = loginResponse.requires_password_change
        ? "/first-login-password"
        : (searchParams.get("redirect") || "/dashboard");
      router.push(redirectTo);
    } catch (err) {
      if (err instanceof ApiError) {
        switch (err.errorType) {
          case "INVALID_CREDENTIALS":
            setError({
              message: "Invalid email or password.",
              type: "credentials",
            });
            break;
          case "NETWORK_ERROR":
            setError({
              message:
                "Unable to connect to the server. Please check your internet connection and try again.",
              type: "network",
            });
            break;
          case "SERVER_ERROR":
            setError({
              message:
                "Our servers are temporarily unavailable. Please try again in a few minutes.",
              type: "server",
            });
            break;
          case "VALIDATION_ERROR":
            setError({
              message: err.message || "Please check your input and try again.",
              type: "validation",
            });
            break;
          default:
            setError({
              message:
                err.message ||
                "An unexpected error occurred. Please try again.",
              type: "unknown",
            });
        }
      } else {
        setError({
          message: "An unexpected error occurred. Please try again.",
          type: "unknown",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getErrorIcon = () => {
    if (!error) return null;
    switch (error.type) {
      case "network":
        return <WifiOff className="w-5 h-5 flex-shrink-0" />;
      case "server":
        return <ServerCrash className="w-5 h-5 flex-shrink-0" />;
      default:
        return <AlertCircle className="w-5 h-5 flex-shrink-0" />;
    }
  };

  const emailError = touched.email
    ? !email.trim()
      ? "Email address is required."
      : !validateEmail(email)
        ? "Please enter a valid email address."
        : ""
    : "";
  const passwordError =
    touched.password
      ? !password
        ? "Password is required."
        : !validatePassword(password)
          ? "Password must be at least 6 characters."
          : ""
      : "";

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
            <span>University</span>
            <br />
            <span className="bg-gradient-to-r from-[#1E54B7] via-[#2563EB] to-[#48CAE4] bg-clip-text text-transparent">
              Timetabling
            </span>
            <br />
            <span>System</span>
          </h1>
        </div>
        <div className="absolute inset-x-0 bottom-20 z-10 flex justify-center px-12 text-center">
          <p className="max-w-sm text-base leading-relaxed text-[var(--text-secondary)]">
            Intelligent scheduling powered by advanced optimization algorithms for efficient resource management.
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
            <div className="mb-8">
              <h2 className="mb-2 text-[2rem] font-bold tracking-[-0.02em] text-white">
                Welcome back
              </h2>
              <p className="text-[0.95rem] text-white/60">
                Sign in to your dashboard
              </p>
            </div>

            <form noValidate onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div
              className="error-banner flex items-start gap-3 rounded-[10px] border border-red-400/40 bg-red-500/12 p-4 text-[0.9rem] text-[#FCA5A5] animate-[fadeIn_0.3s_ease]"
            >
              {getErrorIcon()}
              <div className="flex-1">
                <p className="font-medium">{error.message}</p>
              </div>
            </div>
          )}

          <div className="form-field space-y-2">
            <Label
              htmlFor="email"
              className="text-[0.875rem] font-medium tracking-[0.01em] text-white/85"
            >
              Email address
            </Label>
            <div className="relative">
              <Input
                id="email"
                type="email"
                placeholder="you@university.edu"
                value={email}
                autoComplete="email"
                onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (touched.email) {
                    setTouched((prev) => ({ ...prev, email: false }));
                  }
                }}
                className={`${INPUT_BASE_CLASSES} pr-12 ${
                  emailError
                    ? "input-error"
                    : email.trim() && !emailError
                      ? "input-success"
                      : ""
                } ${shakeField === "email" ? "shake" : ""}`}
                onAnimationEnd={() => {
                  if (shakeField === "email") setShakeField(null);
                }}
              />
              <Mail className="field-icon absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/50 transition-all duration-200" />
            </div>
            {emailError && (
              <p className="mt-1 animate-[fadeIn_0.3s_ease] text-[0.78rem] text-[#FCA5A5]">
                {emailError}
              </p>
            )}
          </div>

          <div className="form-field space-y-2">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="password"
                className="text-[0.875rem] font-medium tracking-[0.01em] text-white/85"
              >
                Password
              </Label>
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-[#48CAE4] transition-colors hover:text-[#90E0EF]"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                autoComplete="current-password"
                onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (touched.password) {
                    setTouched((prev) => ({ ...prev, password: false }));
                  }
                }}
                className={`${INPUT_BASE_CLASSES} pr-12 ${
                  passwordError
                    ? "input-error"
                    : password && !passwordError
                      ? "input-success"
                      : ""
                } ${shakeField === "password" ? "shake" : ""}`}
                onAnimationEnd={() => {
                  if (shakeField === "password") setShakeField(null);
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="field-icon absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-white/50 transition-all duration-200 hover:text-white/90"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {passwordError && (
              <p className="mt-1 animate-[fadeIn_0.3s_ease] text-[0.78rem] text-[#FCA5A5]">
                {passwordError}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading}
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
                Signing in...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <LogIn className="w-5 h-5" />
                Sign In
              </span>
            )}
          </Button>
            </form>

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
        .form-input.input-error {
          border-color: #ef4444 !important;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2) !important;
        }
        .form-input.input-success {
          border-color: #10b981 !important;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15) !important;
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400">
          Loading...
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
