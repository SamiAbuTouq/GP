"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CheckCircle2, Mail, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { departments, type Department } from "@/lib/data";

type CourseOption = { code: string; name: string };
const ELIGIBILITY_MESSAGE =
  "If this email is eligible for access, you will be contacted with further instructions.";

const INPUT_BASE_CLASSES =
  "h-12 w-full min-w-0 rounded-[10px] border px-4 text-white placeholder:text-white/45 backdrop-blur-[4px] transition-all duration-300 ease-out focus:outline-none focus:bg-white/[0.14] focus:border-[#48CAE4] focus:shadow-[0_0_0_3px_rgba(72,202,228,0.18)] bg-white/[0.08] border-white/[0.18]";

// hover:!bg keeps the gradient instead of the default `Button` hover:bg-primary/90.
const PRIMARY_ACTION_CLASSES =
  "rounded-xl bg-[linear-gradient(135deg,#2563EB_0%,#1E54B7_100%)] text-base font-semibold text-white shadow-none transition-[transform,box-shadow,filter] duration-200 ease-out hover:-translate-y-px hover:shadow-[0_8px_28px_rgba(37,99,235,0.45)] hover:brightness-110 hover:!bg-[linear-gradient(135deg,#2563EB_0%,#1E54B7_100%)] active:translate-y-0 active:shadow-none active:brightness-100 disabled:pointer-events-none disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:hover:brightness-100";

export default function LecturerAccessRequestPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState<Department>("Computer Science");
  const [maxWorkload, setMaxWorkload] = useState(15);
  const [courses, setCourses] = useState<string[]>([]);
  const [courseQuery, setCourseQuery] = useState("");
  const [availableCourses, setAvailableCourses] = useState<CourseOption[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesLoaded, setCoursesLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const filteredCourses = useMemo(() => {
    const q = courseQuery.trim().toLowerCase();
    if (!q) return availableCourses;
    return availableCourses.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    );
  }, [availableCourses, courseQuery]);

  const fetchCourses = async () => {
    if (coursesLoaded || coursesLoading) return;
    setCoursesLoading(true);
    try {
      const res = await fetch("/api/courses/public-catalog");
      if (!res.ok) return;
      const data = await res.json();
      const raw = Array.isArray(data) ? data : [];
      setAvailableCourses(
        raw
          .filter((r: unknown) => typeof r === "object" && r !== null)
          .map((r: { code?: unknown; name?: unknown }) => ({
            code: typeof r.code === "string" ? r.code : "",
            name: typeof r.name === "string" ? r.name : "",
          }))
          .filter((r) => r.code && r.name),
      );
    } catch {
      setAvailableCourses([]);
    } finally {
      setCoursesLoading(false);
      setCoursesLoaded(true);
    }
  };

  useEffect(() => {
    void fetchCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkEmail = async (value: string): Promise<boolean> => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    const res = await fetch(`/api/access-requests/check-email?email=${encodeURIComponent(normalized)}`);
    if (!res.ok) return false;
    const data = await res.json();
    if (data.existsAsUser) {
      setInlineError(ELIGIBILITY_MESSAGE);
      return true;
    }
    if (data.hasPendingRequest) {
      setInlineError(ELIGIBILITY_MESSAGE);
      return true;
    }
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);
    const normalizedEmail = email.trim().toLowerCase();

    if (!fullName.trim()) return setInlineError("Full name is required.");
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return setInlineError("Please enter a valid email address.");
    }
    if (maxWorkload < 1 || maxWorkload > 30) {
      return setInlineError("Max workload must be between 1 and 30.");
    }

    try {
      const blocked = await checkEmail(normalizedEmail);
      if (blocked) return;
    } catch {
      return setInlineError("Unable to validate email right now. Please try again.");
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: normalizedEmail,
          department,
          maxWorkload,
          courses,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInlineError(data.error || ELIGIBILITY_MESSAGE);
        return;
      }
      setSubmitted(true);
    } catch {
      setInlineError("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const goToStepTwo = async () => {
    setInlineError(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!fullName.trim()) {
      setInlineError("Full name is required.");
      return;
    }
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setInlineError("Please enter a valid email address.");
      return;
    }
    try {
      const blocked = await checkEmail(normalizedEmail);
      if (blocked) return;
      setStep(2);
    } catch {
      setInlineError("Unable to validate email right now. Please try again.");
    }
  };

  return (
    <div className="forgot-theme flex min-h-dvh flex-col overflow-x-hidden lg:grid lg:h-dvh lg:max-h-dvh lg:grid-cols-[minmax(0,42%)_minmax(0,58%)] lg:overflow-hidden">
      <div className="relative hidden min-h-0 overflow-hidden border-r border-slate-200/20 bg-[var(--bg-left)] lg:flex lg:h-full">
        <div className="relative z-10 mx-auto flex h-full w-full max-w-xl flex-col items-center justify-start px-8 pt-16 pb-12 text-center xl:px-12 xl:pt-20 xl:pb-16">
          <Image src="/images/logo.png" alt="PSUT Logo" width={180} height={180} className="h-auto w-[min(40vw,9rem)] max-w-[180px] object-contain sm:w-36 lg:w-[180px]" priority />
          <h1 className="mt-6 text-balance text-3xl font-bold leading-tight text-[var(--text-primary)] sm:text-4xl xl:mt-8 xl:text-5xl">
            <span>Lecturer</span>
            <br />
            <span className="bg-gradient-to-r from-[#1E54B7] via-[#2563EB] to-[#48CAE4] bg-clip-text text-transparent">
              Access Request
            </span>
          </h1>
        </div>
        <div className="absolute inset-x-0 bottom-16 z-10 flex justify-center px-8 text-center xl:bottom-20 xl:px-12">
          <p className="max-w-sm text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
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
      <div className="relative flex min-h-dvh min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [background:radial-gradient(ellipse_at_30%_20%,#1E54B7_0%,#0D1B4B_45%,#091232_100%)] px-4 py-8 sm:px-6 sm:py-10 lg:min-h-0 lg:h-full lg:overflow-y-auto lg:px-8 lg:py-8 xl:px-12 xl:py-10">
        <div className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_70%_80%,rgba(0,180,216,0.12)_0%,transparent_60%),radial-gradient(circle_at_20%_60%,rgba(37,99,235,0.15)_0%,transparent_50%)]" />
        <div className="relative mx-auto flex w-full max-w-lg flex-1 flex-col justify-center lg:min-h-0">
          <div className="w-full min-w-0 py-1 sm:py-2 lg:py-2">
            {submitted ? (
              <div className="w-full min-w-0 space-y-5 text-center sm:space-y-6">
                <div className="flex justify-center">
                  <CheckCircle2 className="h-12 w-12 text-green-300 sm:h-14 sm:w-14" />
                </div>
                <h2 className="text-2xl font-bold text-white sm:text-[1.75rem] xl:text-[2rem]">Request submitted</h2>
                <p className="text-sm text-white/70 sm:text-[0.95rem]">
                  Your request is now pending review. You will receive an email after it is reviewed.
                </p>
                <Button asChild className={`h-12 w-full ${PRIMARY_ACTION_CLASSES}`}>
                  <Link href="/login" className="flex items-center justify-center gap-2">
                    <ArrowLeft className="w-5 h-5" />
                    Back to Sign In
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-4 sm:mb-5">
                  <h2 className="text-2xl font-bold tracking-[-0.02em] text-white sm:text-[1.75rem] xl:text-[2rem]">Request access</h2>
                </div>
                <form onSubmit={handleSubmit} className="w-full min-w-0 space-y-4">
                  <div className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wide text-white/60 sm:flex-row sm:items-center sm:justify-between">
                    <span>Step {step} of 2</span>
                    <span className="text-[0.7rem] font-medium normal-case tracking-normal text-white/70 sm:text-xs">
                      {step === 1 ? "Personal Information" : "Teaching Profile"}
                    </span>
                  </div>
                  {inlineError ? (
                    <div className="rounded-[10px] border border-red-400/40 bg-red-500/12 p-3 text-sm text-[#FCA5A5]">
                      {inlineError}
                    </div>
                  ) : null}

                  {step === 1 ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-[0.8125rem] font-medium text-white/85 sm:text-sm">Full name</Label>
                        <Input
                          className={INPUT_BASE_CLASSES}
                          placeholder="Enter your full name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[0.8125rem] font-medium text-white/85 sm:text-sm">Email address</Label>
                        <div className="relative">
                          <Input
                            className={`${INPUT_BASE_CLASSES} pr-12`}
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onBlur={() => void checkEmail(email)}
                            onChange={(e) => {
                              setEmail(e.target.value);
                              setInlineError(null);
                            }}
                          />
                          <Mail className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/70" />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {step === 2 ? (
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold tracking-wide text-white/90 sm:text-sm">
                        Teaching Profile
                      </h3>
                      <div className="space-y-2">
                        <Label className="text-[0.8125rem] font-medium text-white/85 sm:text-sm">Department</Label>
                        <Select value={department} onValueChange={(v) => setDepartment(v as Department)}>
                          <SelectTrigger className={`${INPUT_BASE_CLASSES} w-full justify-between`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {departments.map((d) => (
                              <SelectItem key={d} value={d}>{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[0.8125rem] font-medium leading-snug text-white/85 sm:text-sm">
                          Max workload (hrs) for bachelor&apos;s degree
                        </Label>
                        <div className="flex min-w-0 items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex h-12 w-12 items-center justify-center rounded-[10px] border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
                            aria-label="Decrease max workload"
                            onClick={() => setMaxWorkload((prev) => Math.max(1, prev - 1))}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <Input
                            className={`${INPUT_BASE_CLASSES} min-w-0 flex-1 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                            type="number"
                            min={1}
                            max={30}
                            value={maxWorkload}
                            onChange={(e) =>
                              setMaxWorkload(Math.max(1, Math.min(30, Number(e.target.value) || 15)))
                            }
                          />
                          <button
                            type="button"
                            className="inline-flex h-12 w-12 items-center justify-center rounded-[10px] border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
                            aria-label="Increase max workload"
                            onClick={() => setMaxWorkload((prev) => Math.min(30, prev + 1))}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[0.8125rem] font-medium text-white/85 sm:text-sm">Courses you can teach</Label>
                        <Input
                          className={INPUT_BASE_CLASSES}
                          placeholder="Search courses..."
                          value={courseQuery}
                          onChange={(e) => setCourseQuery(e.target.value)}
                        />
                        <div className="custom-scrollbar max-h-28 overflow-y-auto rounded-md border border-white/20 bg-white/5 p-3 text-white">
                          {coursesLoading ? (
                            <p className="text-sm text-white/60">Loading courses...</p>
                          ) : null}
                          {filteredCourses.map((course) => (
                            <div key={course.code} className="mb-2 flex min-w-0 items-start gap-2 text-sm">
                              <Checkbox
                                checked={courses.includes(course.code)}
                                onCheckedChange={() =>
                                  setCourses((prev) =>
                                    prev.includes(course.code)
                                      ? prev.filter((x) => x !== course.code)
                                      : [...prev, course.code],
                                  )
                                }
                                className="mt-0.5 shrink-0"
                              />
                              <span className="min-w-0 break-words leading-snug">
                                <b>{course.code}</b> - {course.name}
                              </span>
                            </div>
                          ))}
                          {!coursesLoading && coursesLoaded && filteredCourses.length === 0 ? (
                            <p className="text-sm text-white/60">No courses found.</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {step === 1 ? (
                    <Button
                      type="button"
                      onClick={() => void goToStepTwo()}
                      className={`h-12 w-full ${PRIMARY_ACTION_CLASSES}`}
                    >
                      Next
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep(1)}
                        className="h-12 flex-1 rounded-xl border-white/20 bg-white/5 text-white shadow-none transition-[transform,box-shadow,background-color,border-color] duration-200 ease-out hover:-translate-y-px hover:border-[#48CAE4]/45 hover:bg-white/[0.14] hover:!text-white hover:shadow-[0_0_0_3px_rgba(72,202,228,0.14)] active:translate-y-0 active:shadow-none"
                      >
                        Back
                      </Button>
                      <Button
                        type="submit"
                        disabled={submitting}
                        className={`h-12 flex-1 ${PRIMARY_ACTION_CLASSES}`}
                      >
                        {submitting ? "Submitting..." : "Submit Request"}
                      </Button>
                    </div>
                  )}
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
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(72, 202, 228, 0.85) rgba(255, 255, 255, 0.12);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #48cae4 0%, #2563eb 100%);
          border-radius: 9999px;
          border: 2px solid rgba(13, 27, 75, 0.9);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #90e0ef 0%, #3b82f6 100%);
        }
      `}</style>
    </div>
  );
}
