"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const INPUT_BASE_CLASSES =
  "h-12 w-full min-w-0 rounded-[10px] border px-4 text-white placeholder:text-white/45 backdrop-blur-[4px] transition-all duration-300 ease-out focus:outline-none focus:bg-white/[0.14] focus:border-[#48CAE4] focus:shadow-[0_0_0_3px_rgba(72,202,228,0.18)] bg-white/[0.08] border-white/[0.18]";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const { toast } = useToast();

  const emailError = emailTouched
    ? !email.trim()
      ? "Please enter your email address"
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ? "Please enter a valid email address"
        : ""
    : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    const normalizedEmail = email.trim();
    if (
      !normalizedEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      return;
    }
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to process request",
          variant: "destructive"
        });
        return;
      }
      setIsSubmitted(true);
    } catch(err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="forgot-theme flex min-h-dvh flex-col lg:grid lg:h-dvh lg:max-h-dvh lg:grid-cols-[minmax(0,42%)_minmax(0,58%)] lg:overflow-hidden">
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
            <span className="bg-gradient-to-r from-[#1E54B7] via-[#2563EB] to-[#48CAE4] bg-clip-text text-transparent">
              Password
            </span>
            <br />
            Recovery
          </h1>
        </div>
        <div className="absolute inset-x-0 bottom-16 z-10 flex justify-center px-8 text-center xl:bottom-20 xl:px-12">
          <p className="max-w-sm text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
            Enter your email to receive a secure reset link and quickly restore access.
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
                    {isSubmitted ? (
                      /* Success State */
                      <div className="w-full min-w-0 space-y-5 text-center sm:space-y-6">
                        <div className="flex justify-center">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 ring-8 ring-green-200/20 sm:h-20 sm:w-20">
                            <CheckCircle2 className="h-8 w-8 text-green-300 sm:h-10 sm:w-10" />
                          </div>
                        </div>
                        <div>
                          <h2 className="mb-2 text-2xl font-bold tracking-[-0.02em] text-white sm:text-[1.75rem] xl:text-[2rem]">
                            Check your email
                          </h2>
                          <p className="text-sm text-white/60 sm:text-[0.95rem]">
                            {"We've sent a password reset link to your email address"}
                          </p>
                        </div>
                        <p className="rounded-2xl border border-white/20 bg-white/10 p-3 text-left text-sm text-slate-200 sm:p-4 sm:text-[0.95rem]">
                          If an account exists for{" "}
                          <strong className="text-white">
                            {email}
                          </strong>
                          , you will receive an email with instructions to reset your
                          password.
                        </p>
                        <Button
                          asChild
                          className="h-12 w-full rounded-xl bg-[linear-gradient(135deg,#2563EB_0%,#1E54B7_100%)] text-base font-semibold text-white transition-[transform,box-shadow] duration-150 hover:-translate-y-[1px] hover:shadow-[0_6px_20px_rgba(37,99,235,0.4)] active:translate-y-0 active:shadow-none"
                        >
                          <Link
                            href="/login"
                            className="flex items-center justify-center gap-2"
                          >
                            <ArrowLeft className="w-5 h-5" />
                            Back to Sign In
                          </Link>
                        </Button>
                      </div>
                    ) : (
                      /* Form State */
                      <>
                        <div className="mb-6 sm:mb-8">
                          <h2 className="mb-2 text-2xl font-bold tracking-[-0.02em] text-white sm:text-[1.75rem] xl:text-[2rem]">
                            Reset password
                          </h2>
                          <p className="text-sm text-white/60 sm:text-[0.95rem]">
                            Enter your email and {"we'll"} send you a reset link
                          </p>
                        </div>

                        <form onSubmit={handleSubmit} className="w-full min-w-0 space-y-5 sm:space-y-6">
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
                                onBlur={() => setEmailTouched(true)}
                                onChange={(e) => {
                                  setEmail(e.target.value);
                                  if (!emailTouched) setEmailTouched(true);
                                }}
                                className={`${INPUT_BASE_CLASSES} pr-12 ${
                                  emailError
                                    ? "border-[#EF4444] shadow-[0_0_0_3px_rgba(239,68,68,0.2)] animate-[shake_0.4s_ease]"
                                    : email.trim() && !emailError
                                      ? "border-[#10B981] shadow-[0_0_0_3px_rgba(16,185,129,0.18)]"
                                      : ""
                                }`}
                                required
                              />
                              <Mail className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/70" />
                            </div>
                            {emailError && (
                              <p className="mt-1 animate-[fadeIn_0.3s_ease] text-[0.78rem] text-[#FCA5A5]">
                                {emailError}
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
                                Sending...
                              </span>
                            ) : (
                              "Send Reset Link"
                            )}
                          </Button>

                          <div className="scroll-mt-6 pt-2 text-center">
                            <Link
                              href="/login"
                              className="group inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-[#48CAE4] transition-[color,transform,background-color] duration-200 ease-out hover:-translate-y-px hover:bg-white/[0.06] hover:text-[#90E0EF] active:translate-y-0"
                            >
                              <ArrowLeft className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5" />
                              Back to Sign In
                            </Link>
                          </div>
                        </form>

                        <p className="mt-6 text-center text-xs text-white/50 sm:mt-8 sm:text-[0.85rem]">
                          Need help?{" "}
                          <Link
                            href="/help"
                            className="font-medium text-[#48CAE4] transition-colors hover:text-[#90E0EF]"
                          >
                            Contact IT Support
                          </Link>
                        </p>
                      </>
                    )}
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
          animation: slideUpFade 0.5s ease 0.1s both;
        }
        .sign-in-btn {
          animation: slideUpFade 0.5s ease 0.25s both;
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
