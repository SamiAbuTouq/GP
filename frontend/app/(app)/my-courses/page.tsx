"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Minus, Plus, X } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Course = {
  courseId: number;
  code: string;
  name: string;
  department: string;
  level: number;
};

type CourseRequest = {
  requestId: number;
  addCourses: Course[];
  removeCourses: Course[];
  note: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
};

function statusBadge(status: CourseRequest["status"]) {
  if (status === "APPROVED") return { label: "Approved", className: "border-emerald-300 text-emerald-700" };
  if (status === "REJECTED") return { label: "Rejected", className: "border-rose-300 text-rose-700" };
  if (status === "CANCELLED") return { label: "Cancelled", className: "border-slate-300 text-slate-700" };
  return { label: "Pending", className: "" };
}

export default function MyCoursesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancelingId, setCancelingId] = useState<number | null>(null);
  const [authorizedCourses, setAuthorizedCourses] = useState<Course[]>([]);
  const [catalogCourses, setCatalogCourses] = useState<Course[]>([]);
  const [requests, setRequests] = useState<CourseRequest[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [selectedAddIds, setSelectedAddIds] = useState<number[]>([]);
  const [selectedRemoveIds, setSelectedRemoveIds] = useState<number[]>([]);
  const [note, setNote] = useState("");

  const refreshAll = async () => {
    setLoading(true);
    try {
      const [authRes, catalogRes, reqRes] = await Promise.all([
        fetch("/api/my-courses/authorized-courses", { cache: "no-store" }),
        fetch("/api/my-courses/catalog", { cache: "no-store" }),
        fetch("/api/my-courses/requests", { cache: "no-store" }),
      ]);
      const [authData, catalogData, reqData] = await Promise.all([
        authRes.json(),
        catalogRes.json(),
        reqRes.json(),
      ]);
      if (!authRes.ok) throw new Error(authData.error || "Failed to load authorized courses.");
      if (!catalogRes.ok) throw new Error(catalogData.error || "Failed to load course catalog.");
      if (!reqRes.ok) throw new Error(reqData.error || "Failed to load request history.");
      setAuthorizedCourses(Array.isArray(authData) ? authData : []);
      setCatalogCourses(Array.isArray(catalogData) ? catalogData : []);
      setRequests(Array.isArray(reqData) ? reqData : []);
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to load my courses.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const authorizedIds = useMemo(
    () => new Set(authorizedCourses.map((course) => course.courseId)),
    [authorizedCourses],
  );

  const addableCourses = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    return catalogCourses.filter((course) => {
      if (authorizedIds.has(course.courseId)) return false;
      if (!q) return true;
      return course.code.toLowerCase().includes(q) || course.name.toLowerCase().includes(q);
    });
  }, [catalogCourses, authorizedIds, catalogQuery]);

  const removableCourses = useMemo(() => {
    const visibleAuthorized = authorizedCourses
      .filter((course) => !selectedRemoveIds.includes(course.courseId))
      .map((course) => ({ ...course, source: "authorized" as const }));

    const selectedAddSet = new Set(selectedAddIds);
    const selectedAdded = catalogCourses
      .filter((course) => selectedAddSet.has(course.courseId))
      .map((course) => ({ ...course, source: "added" as const }));

    return [...visibleAuthorized, ...selectedAdded];
  }, [authorizedCourses, selectedRemoveIds, catalogCourses, selectedAddIds]);

  const toggleSelected = (
    ids: number[],
    setter: (value: number[] | ((prev: number[]) => number[])) => void,
    id: number,
  ) => {
    setter(ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id]);
  };

  const submitRequest = async () => {
    if (selectedAddIds.length === 0 && selectedRemoveIds.length === 0) {
      toast({
        title: "Nothing selected",
        description: "Select at least one course to add or remove.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/my-courses/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addCourseIds: selectedAddIds,
          removeCourseIds: selectedRemoveIds,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit request.");
      setRequests((prev) => [data as CourseRequest, ...prev]);
      setDialogOpen(false);
      setSelectedAddIds([]);
      setSelectedRemoveIds([]);
      setNote("");
      setCatalogQuery("");
      toast({ title: "Request submitted", description: "Your course modification request is now pending review." });
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to submit request.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = async (id: number) => {
    setCancelingId(id);
    try {
      const res = await fetch(`/api/my-courses/requests/${id}/cancel`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel request.");
      setRequests((prev) =>
        prev.map((r) => (r.requestId === id ? (data as CourseRequest) : r)),
      );
      toast({ title: "Request cancelled", description: "Your pending request has been cancelled." });
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to cancel request.",
        variant: "destructive",
      });
    } finally {
      setCancelingId(null);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="mx-auto w-full max-w-[1680px] space-y-6">
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-foreground">My Courses</h1>
              <p className="text-sm text-muted-foreground">
                View your authorized courses and submit course modification requests.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>My Authorized Courses</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading courses...
                  </div>
                ) : authorizedCourses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No authorized courses found.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {authorizedCourses.map((course) => (
                      <div key={course.courseId} className="rounded-md border p-3">
                        <p className="font-semibold">{course.name}</p>
                        <p className="text-sm text-muted-foreground">{course.code}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {course.department} · Level {course.level}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle>Course Modification Requests</CardTitle>
                <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
                  <SheetTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      New Request
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-full overflow-y-auto p-6 sm:max-w-2xl">
                    <SheetHeader>
                      <SheetTitle>Submit Course Modification Request</SheetTitle>
                    </SheetHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Courses to Add</p>
                        <Input
                          value={catalogQuery}
                          onChange={(e) => setCatalogQuery(e.target.value)}
                          placeholder="Search by code, name, department, level..."
                        />
                        <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border p-2">
                          {addableCourses.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No matching courses.</p>
                          ) : (
                            addableCourses.map((course) => (
                              <label
                                key={course.courseId}
                                className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 hover:bg-muted/50"
                              >
                                <Checkbox
                                  checked={selectedAddIds.includes(course.courseId)}
                                  onCheckedChange={() =>
                                    toggleSelected(selectedAddIds, setSelectedAddIds, course.courseId)
                                  }
                                />
                                <span className="text-sm">
                                  <span className="font-medium">{course.code}</span> - {course.name}
                                  <span className="block text-xs text-muted-foreground">
                                    {course.department} · Level {course.level}
                                  </span>
                                </span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium">Courses to Remove</p>
                        <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-2">
                          {authorizedCourses.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No authorized courses available.</p>
                          ) : removableCourses.length === 0 ? (
                            <p className="text-sm text-muted-foreground">All courses are marked for removal.</p>
                          ) : (
                            removableCourses.map((course) => (
                              <div
                                key={`remove-${course.courseId}`}
                                className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted/40"
                              >
                                <span className="truncate pr-3">
                                  <span className="font-medium">{course.code}</span> - {course.name}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-rose-700"
                                  onClick={() => {
                                    if (course.source === "added") {
                                      setSelectedAddIds((prev) =>
                                        prev.filter((id) => id !== course.courseId),
                                      );
                                      return;
                                    }
                                    setSelectedRemoveIds((prev) =>
                                      prev.includes(course.courseId) ? prev : [...prev, course.courseId],
                                    );
                                  }}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium">Note (optional)</p>
                        <Textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Optional short note or justification..."
                          className="min-h-[90px]"
                          maxLength={1000}
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button onClick={submitRequest} disabled={submitting}>
                          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Submit Request
                        </Button>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </CardHeader>

              <CardContent className="space-y-3">
                {loading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading request history...
                  </div>
                ) : requests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No requests submitted yet.</p>
                ) : (
                  requests.map((request) => {
                    const badge = statusBadge(request.status);
                    return (
                      <div key={request.requestId} className="rounded-md border p-3">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">
                            Submitted: {new Date(request.submittedAt).toLocaleString()}
                          </p>
                          <Badge variant="outline" className={cn("font-medium", badge.className)}>
                            {badge.label}
                          </Badge>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div>
                            <p className="mb-1 font-medium text-emerald-700">Add</p>
                            <div className="flex flex-wrap gap-1">
                              {request.addCourses.length === 0 ? (
                                <span className="text-muted-foreground">None</span>
                              ) : (
                                request.addCourses.map((course) => (
                                  <Badge key={`add-${request.requestId}-${course.courseId}`} variant="outline" className="border-emerald-300 text-emerald-700">
                                    {course.code}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="mb-1 font-medium text-rose-700">Remove</p>
                            <div className="flex flex-wrap gap-1">
                              {request.removeCourses.length === 0 ? (
                                <span className="text-muted-foreground">None</span>
                              ) : (
                                request.removeCourses.map((course) => (
                                  <Badge key={`remove-${request.requestId}-${course.courseId}`} variant="outline" className="border-rose-300 text-rose-700">
                                    {course.code}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </div>
                          {request.note ? (
                            <p className="text-muted-foreground">Note: {request.note}</p>
                          ) : null}
                          {request.status === "REJECTED" ? (
                            <p className="text-sm text-rose-700">
                              Rejection reason: {request.rejectionReason || "No reason provided"}
                            </p>
                          ) : null}
                        </div>
                        {request.status === "PENDING" ? (
                          <div className="mt-3 flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={cancelingId === request.requestId}
                              onClick={() => void cancelRequest(request.requestId)}
                            >
                              {cancelingId === request.requestId ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <X className="mr-2 h-4 w-4" />
                              )}
                              Cancel
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
