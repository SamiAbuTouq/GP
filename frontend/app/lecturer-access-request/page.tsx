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
  "h-12 rounded-[10px] border px-4 text-white placeholder:text-white/45 backdrop-blur-[4px] transition-all duration-300 ease-out focus:outline-none focus:bg-white/[0.14] focus:border-[#48CAE4] focus:shadow-[0_0_0_3px_rgba(72,202,228,0.18)] bg-white/[0.08] border-white/[0.18]";

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
    <div className="forgot-theme min-h-screen overflow-hidden lg:h-screen lg:grid lg:grid-cols-[42%_58%]">
      <div className="relative hidden lg:flex overflow-hidden border-r border-slate-200/20 bg-[var(--bg-left)]">
        <div className="relative z-10 mx-auto flex h-full w-full max-w-xl flex-col items-center justify-start px-12 pt-20 pb-16 text-center">
          <Image src="/images/logo.png" alt="PSUT Logo" width={180} height={180} className="object-contain" priority />
          <h1 className="mt-8 text-5xl font-bold leading-tight text-[var(--text-primary)]">
            <span>Lecturer</span>
            <br />
            <span className="bg-gradient-to-r from-[#1E54B7] via-[#2563EB] to-[#48CAE4] bg-clip-text text-transparent">
              Access Request
            </span>
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
      <div className="relative overflow-hidden p-6 lg:h-screen lg:p-10 [background:radial-gradient(ellipse_at_30%_20%,#1E54B7_0%,#0D1B4B_45%,#091232_100%)]">
        <div className="relative mx-auto flex min-h-screen w-full max-w-md items-start py-6 lg:h-full lg:min-h-0 lg:items-start lg:pt-10">
          <div className="w-full py-2 lg:py-0">
            {submitted ? (
              <div className="text-center space-y-6">
                <div className="flex justify-center">
                  <CheckCircle2 className="w-14 h-14 text-green-300" />
                </div>
                <h2 className="text-[2rem] font-bold text-white">Request submitted</h2>
                <p className="text-[0.95rem] text-white/70">
                  Your request is now pending review. You will receive an email after it is reviewed.
                </p>
                <Button asChild className="h-12 w-full rounded-xl bg-[linear-gradient(135deg,#2563EB_0%,#1E54B7_100%)]">
                  <Link href="/login" className="flex items-center justify-center gap-2">
                    <ArrowLeft className="w-5 h-5" />
                    Back to Sign In
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-5">
                  <h2 className="mb-2 text-[2rem] font-bold tracking-[-0.02em] text-white">Request access</h2>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-white/60">
                    <span>Step {step} of 2</span>
                    <span>{step === 1 ? "Personal Information" : "Teaching Profile"}</span>
                  </div>
                  {inlineError ? (
                    <div className="rounded-[10px] border border-red-400/40 bg-red-500/12 p-3 text-sm text-[#FCA5A5]">
                      {inlineError}
                    </div>
                  ) : null}

                  {step === 1 ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-white/85">Full name</Label>
                        <Input
                          className={INPUT_BASE_CLASSES}
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white/85">Email address</Label>
                        <div className="relative">
                          <Input
                            className={`${INPUT_BASE_CLASSES} pr-12`}
                            type="email"
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
                      <h3 className="text-sm font-semibold tracking-wide text-white/90">Teaching Profile</h3>
                      <div className="space-y-2">
                        <Label className="text-white/85">Department</Label>
                        <Select value={department} onValueChange={(v) => setDepartment(v as Department)}>
                          <SelectTrigger className={INPUT_BASE_CLASSES}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {departments.map((d) => (
                              <SelectItem key={d} value={d}>{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white/85">Max workload (hrs) for bachelor&apos;s degree</Label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex h-12 w-12 items-center justify-center rounded-[10px] border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
                            aria-label="Decrease max workload"
                            onClick={() => setMaxWorkload((prev) => Math.max(1, prev - 1))}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <Input
                            className={`${INPUT_BASE_CLASSES} text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
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
                        <Label className="text-white/85">Courses you can teach</Label>
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
                            <div key={course.code} className="mb-2 flex items-start gap-2 text-sm">
                              <Checkbox
                                checked={courses.includes(course.code)}
                                onCheckedChange={() =>
                                  setCourses((prev) =>
                                    prev.includes(course.code)
                                      ? prev.filter((x) => x !== course.code)
                                      : [...prev, course.code],
                                  )
                                }
                              />
                              <span><b>{course.code}</b> - {course.name}</span>
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
                      className="h-12 w-full rounded-xl bg-[linear-gradient(135deg,#2563EB_0%,#1E54B7_100%)] text-base font-semibold text-white"
                    >
                      Next
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep(1)}
                        className="h-12 flex-1 border-white/20 bg-white/5 text-white hover:bg-white/10"
                      >
                        Back
                      </Button>
                      <Button
                        type="submit"
                        disabled={submitting}
                        className="h-12 flex-1 rounded-xl bg-[linear-gradient(135deg,#2563EB_0%,#1E54B7_100%)] text-base font-semibold text-white"
                      >
                        {submitting ? "Submitting..." : "Submit Request"}
                      </Button>
                    </div>
                  )}
                  <div className="text-center">
                    <Link href="/login" className="inline-flex items-center gap-2 text-sm font-medium text-[#48CAE4] hover:text-[#90E0EF]">
                      <ArrowLeft className="w-4 h-4" />
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
