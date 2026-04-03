"use client";

import type React from "react";
import { useState } from "react";
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

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!email.trim()) {
      setError({
        message: "Please enter your email address",
        type: "validation",
      });
      setIsLoading(false);
      return;
    }

    if (!password) {
      setError({ message: "Please enter your password", type: "validation" });
      setIsLoading(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError({
        message: "Please enter a valid email address",
        type: "validation",
      });
      setIsLoading(false);
      return;
    }

    try {
      await ApiClient.login(email.trim(), password);
      const redirectTo = searchParams.get("redirect") || "/dashboard";
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

  const getErrorStyles = () => {
    if (!error) return "";
    switch (error.type) {
      case "network":
        return "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-400";
      case "server":
        return "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/50 dark:border-orange-800 dark:text-orange-400";
      default:
        return "bg-red-50 border-red-200 text-red-600 dark:bg-red-950/50 dark:border-red-800 dark:text-red-400";
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-950">
      {/* Left Panel - Branding (Blue Background) */}
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
          {/* Logo - Bigger and no frame */}
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
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-6 ">
              <span className="text-white">University</span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Timetabling
              </span>
              <br />
              <span className="text-white">System</span>
            </h1>
            <p className="text-slate-400 text-lg max-w-sm leading-relaxed">
              Intelligent scheduling powered by advanced optimization algorithms
              for efficient resource management.
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form (White Background) */}
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

          {/* Welcome Text */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Welcome back
            </h2>
            <p className="text-slate-500 dark:text-slate-400">
              Sign in to your dashboard
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div
                className={`p-4 rounded-xl border text-sm flex items-start gap-3 ${getErrorStyles()}`}
              >
                {getErrorIcon()}
                <div className="flex-1">
                  <p className="font-medium">{error.message}</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Email address
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="you@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 pl-4 pr-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 focus:ring-blue-500/20 transition-all"
                  required
                />
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
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
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
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
