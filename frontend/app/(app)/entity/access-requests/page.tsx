"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Loader2, Mail, Search } from "lucide-react";
import { EntityLayout } from "@/components/entity-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { ApiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type TabKey = "PENDING" | "APPROVED" | "REJECTED";
type RequestTypeTab = "ACCESS" | "COURSE_MODIFICATION";

type CourseInRequest = { code: string; name: string | null };

type AccessRequest = {
  requestId: number;
  fullName: string;
  email: string;
  department: string;
  maxWorkload: number;
  courses: CourseInRequest[];
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  submittedAt: string;
  expiresAt?: string;
  reviewedAt?: string | null;
};

function normalizeCourses(raw: unknown): CourseInRequest[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") {
      return { code: item.trim(), name: null };
    }
    if (item && typeof item === "object" && "code" in item) {
      const o = item as { code: unknown; name?: unknown };
      return {
        code: String(o.code ?? "").trim(),
        name: o.name != null && String(o.name).trim() !== "" ? String(o.name) : null,
      };
    }
    return { code: String(item), name: null };
  });
}

function normalizeRow(raw: Record<string, unknown>): AccessRequest {
  return {
    requestId: Number(raw.requestId),
    fullName: String(raw.fullName ?? ""),
    email: String(raw.email ?? ""),
    department: String(raw.department ?? ""),
    maxWorkload: Number(raw.maxWorkload ?? 0),
    courses: normalizeCourses(raw.courses),
    status: raw.status as AccessRequest["status"],
    rejectionReason: raw.rejectionReason != null ? String(raw.rejectionReason) : null,
    submittedAt: String(raw.submittedAt ?? ""),
    expiresAt: raw.expiresAt != null ? String(raw.expiresAt) : undefined,
    reviewedAt: raw.reviewedAt != null ? String(raw.reviewedAt) : null,
  };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function statusBadgeProps(status: AccessRequest["status"]) {
  switch (status) {
    case "APPROVED":
      return {
        variant: "outline" as const,
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
        label: "Approved",
      };
    case "REJECTED":
      return {
        variant: "destructive" as const,
        className: "",
        label: "Rejected",
      };
    default:
      return { variant: "default" as const, className: "", label: "Pending" };
  }
}

function DetailLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
      <span className="shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <span className="min-w-0 text-sm text-foreground">{value}</span>
    </div>
  );
}

function AccessRequestRow({
  r,
  rejectReasonById,
  setRejectReasonById,
  actingId,
  approve,
  reject,
}: {
  r: AccessRequest;
  rejectReasonById: Record<number, string>;
  setRejectReasonById: Dispatch<SetStateAction<Record<number, string>>>;
  actingId: number | null;
  approve: (id: number) => void;
  reject: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const badge = statusBadgeProps(r.status);
  const busy = actingId === r.requestId;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border-b border-border/60 last:border-b-0">
        <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-2 sm:px-4 sm:py-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary"
              aria-hidden
            >
              {initials(r.fullName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <a href={`mailto:${r.email}`} className="truncate text-sm font-medium text-primary hover:underline">
                  {r.email}
                </a>
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{r.fullName}</span>
            </span>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground"
                aria-expanded={open}
                aria-label={open ? "Hide details" : "Show details"}
              >
                <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:shrink-0">
            {r.status !== "PENDING" ? (
              <Badge variant={badge.variant} className={cn("shrink-0", badge.className)}>
                {badge.label}
              </Badge>
            ) : null}
            {r.status === "PENDING" ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy} onClick={() => void approve(r.requestId)}>
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void reject(r.requestId)}
                >
                  Reject
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <CollapsibleContent className="overflow-hidden">
          <div className="space-y-4 border-t border-border/50 bg-muted/20 px-3 py-3 sm:px-4 sm:py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailLine label="Department" value={r.department || "—"} />
              <DetailLine label="Submitted" value={new Date(r.submittedAt).toLocaleString()} />
              <DetailLine label="Max workload (hrs)" value={`${r.maxWorkload} (bachelor's)`} />
              {r.status === "PENDING" && r.expiresAt ? (
                <DetailLine label="Expires" value={new Date(r.expiresAt).toLocaleString()} />
              ) : null}
              {r.reviewedAt ? (
                <DetailLine label="Reviewed" value={new Date(r.reviewedAt).toLocaleString()} />
              ) : null}
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Courses they can teach</p>
              {r.courses.length === 0 ? (
                <p className="text-sm text-muted-foreground">None selected</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5" aria-label="Courses">
                  {r.courses.map((c) => {
                    const tip = c.name ? `${c.code} — ${c.name}` : c.code;
                    return (
                      <li
                        key={`${r.requestId}-${c.code}`}
                        title={tip}
                        className="max-w-full rounded-md border border-border/70 bg-background/80 px-2 py-1 text-xs leading-snug"
                      >
                        <span className="font-mono font-semibold text-foreground">{c.code}</span>
                        {c.name ? (
                          <span className="text-muted-foreground"> · {c.name}</span>
                        ) : (
                          <span className="text-muted-foreground/80"> · —</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {r.status === "REJECTED" ? (
              <div className="border-l-2 border-destructive/60 pl-3">
                <p className="text-xs font-medium text-destructive">Rejection reason</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {r.rejectionReason || "No reason provided."}
                </p>
              </div>
            ) : null}

            {r.status === "PENDING" ? (
              <div className="space-y-2">
                <Label htmlFor={`reject-${r.requestId}`} className="text-xs text-muted-foreground">
                  Optional note when rejecting (emailed to the lecturer)
                </Label>
                <Textarea
                  id={`reject-${r.requestId}`}
                  placeholder="e.g. Incomplete information…"
                  value={rejectReasonById[r.requestId] ?? ""}
                  onChange={(e) =>
                    setRejectReasonById((prev) => ({ ...prev, [r.requestId]: e.target.value }))
                  }
                  className="min-h-[72px] resize-y bg-background text-sm"
                />
              </div>
            ) : null}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function AccessRequestsPanel({
  onPendingCountChange,
}: {
  onPendingCountChange: (count: number | null) => void;
}) {
  const [status, setStatus] = useState<TabKey>("PENDING");
  const [byTab, setByTab] = useState<Record<TabKey, AccessRequest[] | undefined>>({
    PENDING: undefined,
    APPROVED: undefined,
    REJECTED: undefined,
  });
  const byTabRef = useRef(byTab);
  byTabRef.current = byTab;

  const [listRefreshing, setListRefreshing] = useState(false);
  const [rejectReasonById, setRejectReasonById] = useState<Record<number, string>>({});
  const [actingId, setActingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const rowsForTab = byTab[status];
  const listLoading = rowsForTab === undefined;
  const rows = rowsForTab ?? [];

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q),
    );
  }, [rows, searchQuery]);

  const fetchTab = useCallback(
    async (tab: TabKey, signal?: AbortSignal): Promise<AccessRequest[]> => {
      const res = await fetch(`/api/access-requests?status=${tab}`, {
        cache: "no-store",
        signal,
        headers: ApiClient.proxyAuthorizationHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load access requests.");
      const list = Array.isArray(data) ? data : [];
      return list.map((r: Record<string, unknown>) => normalizeRow(r));
    },
    [],
  );

  useEffect(() => {
    const tab = status;
    const ac = new AbortController();
    const hadCache = byTabRef.current[tab] !== undefined;

    if (hadCache) setListRefreshing(true);

    void (async () => {
      try {
        const list = await fetchTab(tab, ac.signal);
        if (ac.signal.aborted) return;
        setByTab((prev) => ({ ...prev, [tab]: list }));
      } catch (e) {
        if (ac.signal.aborted) return;
        toast({
          title: "Error",
          description: e instanceof Error ? e.message : "Failed to load access requests.",
          variant: "destructive",
        });
        setByTab((prev) => ({ ...prev, [tab]: prev[tab] ?? [] }));
      } finally {
        if (!ac.signal.aborted) setListRefreshing(false);
      }
    })();

    return () => {
      ac.abort();
      setListRefreshing(false);
    };
    // toast is stable from useToast; omit from deps to avoid extra refetches
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, fetchTab]);

  useEffect(() => {
    setSearchQuery("");
  }, [status]);

  useEffect(() => {
    onPendingCountChange(byTab.PENDING ? byTab.PENDING.length : null);
  }, [byTab.PENDING, onPendingCountChange]);

  const approve = async (id: number) => {
    setActingId(id);
    try {
      const res = await fetch(`/api/access-requests/${id}/approve`, {
        method: "PATCH",
        headers: ApiClient.proxyAuthorizationHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve request.");
      toast({ title: "Success", description: "Access request approved." });
      setByTab((prev) => ({
        ...prev,
        PENDING: prev.PENDING?.filter((r) => r.requestId !== id),
        APPROVED: undefined,
      }));
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to approve request.",
        variant: "destructive",
      });
    } finally {
      setActingId(null);
    }
  };

  const reject = async (id: number) => {
    setActingId(id);
    try {
      const res = await fetch(`/api/access-requests/${id}/reject`, {
        method: "PATCH",
        headers: {
          ...ApiClient.proxyAuthorizationHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: rejectReasonById[id] || "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject request.");
      toast({ title: "Success", description: "Access request rejected." });
      setByTab((prev) => ({
        ...prev,
        PENDING: prev.PENDING?.filter((r) => r.requestId !== id),
        REJECTED: undefined,
      }));
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to reject request.",
        variant: "destructive",
      });
    } finally {
      setActingId(null);
    }
  };

  const statusLabel =
    status === "PENDING" ? "Pending" : status === "APPROVED" ? "Approved" : "Rejected";

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <CardHeader className="space-y-3 border-b border-border/60 bg-muted/20 py-3 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight">
            <span>
              {statusLabel} requests
              <span className="ml-2 text-base font-normal text-muted-foreground">
                {listLoading
                  ? "(…)"
                  : `(${filteredRows.length}${
                      searchQuery.trim() && filteredRows.length !== rows.length
                        ? ` · ${rows.length} total`
                        : ""
                    })`}
              </span>
            </span>
            {listRefreshing && !listLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
            ) : null}
            <span className="sr-only" aria-live="polite">
              {listRefreshing && !listLoading ? "Refreshing list" : ""}
            </span>
          </CardTitle>
          <Tabs value={status} onValueChange={(v) => setStatus(v as TabKey)}>
            <TabsList>
              <TabsTrigger value="PENDING">Pending</TabsTrigger>
              <TabsTrigger value="APPROVED">Approved</TabsTrigger>
              <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Search by name or email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9"
            aria-label="Search requests by name or email"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {listLoading ? <p className="p-4 text-sm text-muted-foreground">Loading…</p> : null}
        {!listLoading && rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No requests found.</p>
        ) : null}
        {!listLoading && rows.length > 0 && filteredRows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No requests match your search.</p>
        ) : null}
        {!listLoading && filteredRows.length > 0
          ? filteredRows.map((r) => (
              <AccessRequestRow
                key={r.requestId}
                r={r}
                rejectReasonById={rejectReasonById}
                setRejectReasonById={setRejectReasonById}
                actingId={actingId}
                approve={approve}
                reject={reject}
              />
            ))
          : null}
      </CardContent>
    </Card>
  );
}

type CourseSummary = {
  courseId: number;
  code: string;
  name: string;
  department: string;
  level: number;
};

type CourseModificationRequest = {
  requestId: number;
  lecturerUserId: number;
  lecturerName: string;
  lecturerEmail: string;
  lecturerDepartment: string;
  addCourses: CourseSummary[];
  removeCourses: CourseSummary[];
  authorizedCourses: CourseSummary[];
  note: string | null;
  status: TabKey;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
};

function courseModificationStatusBadgeProps(status: TabKey) {
  if (status === "APPROVED") {
    return {
      variant: "outline" as const,
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
      label: "Approved",
    };
  }
  if (status === "REJECTED") {
    return { variant: "destructive" as const, className: "", label: "Rejected" };
  }
  return { variant: "default" as const, className: "", label: "Pending" };
}

function CoursePill({
  course,
  tone,
}: {
  course: CourseSummary;
  tone: "add" | "remove";
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "max-w-full",
        tone === "add"
          ? "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300"
          : "border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300",
      )}
      title={`${course.code} — ${course.name}`}
    >
      {course.code}
    </Badge>
  );
}

function CourseModificationRequestRow({
  r,
  rejectReasonById,
  setRejectReasonById,
  actingId,
  approve,
  reject,
}: {
  r: CourseModificationRequest;
  rejectReasonById: Record<number, string>;
  setRejectReasonById: Dispatch<SetStateAction<Record<number, string>>>;
  actingId: number | null;
  approve: (id: number) => void;
  reject: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const busy = actingId === r.requestId;
  const badge = courseModificationStatusBadgeProps(r.status);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border-b border-border/60 last:border-b-0">
        <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-2 sm:px-4 sm:py-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary"
              aria-hidden
            >
              {initials(r.lecturerName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <a
                  href={`mailto:${r.lecturerEmail}`}
                  className="truncate text-sm font-medium text-primary hover:underline"
                >
                  {r.lecturerEmail}
                </a>
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {r.lecturerName} · {r.lecturerDepartment || "—"} ·{" "}
                {new Date(r.submittedAt).toLocaleString()}
              </span>
              <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {r.addCourses.map((course) => (
                  <CoursePill key={`add-${r.requestId}-${course.courseId}`} course={course} tone="add" />
                ))}
                {r.removeCourses.map((course) => (
                  <CoursePill
                    key={`remove-${r.requestId}-${course.courseId}`}
                    course={course}
                    tone="remove"
                  />
                ))}
                {r.addCourses.length === 0 && r.removeCourses.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No course changes</span>
                ) : null}
              </span>
            </span>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground"
                aria-expanded={open}
                aria-label={open ? "Hide details" : "Show details"}
              >
                <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:shrink-0">
            {r.status !== "PENDING" ? (
              <Badge variant={badge.variant} className={cn("shrink-0", badge.className)}>
                {badge.label}
              </Badge>
            ) : null}
            {r.status === "PENDING" ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy} onClick={() => void approve(r.requestId)}>
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void reject(r.requestId)}
                >
                  Reject
                </Button>
              </div>
            ) : null}
          </div>
        </div>
        <CollapsibleContent className="overflow-hidden">
          <div className="space-y-4 border-t border-border/50 bg-muted/20 px-3 py-3 sm:px-4 sm:py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailLine label="Department" value={r.lecturerDepartment || "—"} />
              <DetailLine label="Submitted" value={new Date(r.submittedAt).toLocaleString()} />
              {r.reviewedAt ? (
                <DetailLine label="Reviewed" value={new Date(r.reviewedAt).toLocaleString()} />
              ) : null}
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Current authorized courses
              </p>
              {r.authorizedCourses.length === 0 ? (
                <p className="text-sm text-muted-foreground">None assigned</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {r.authorizedCourses.map((course) => (
                    <li
                      key={`authorized-${r.requestId}-${course.courseId}`}
                      className="max-w-full rounded-md border border-border/70 bg-background/80 px-2 py-1 text-xs leading-snug"
                    >
                      <span className="font-mono font-semibold text-foreground">{course.code}</span>
                      <span className="text-muted-foreground"> · {course.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  Courses to add
                </p>
                {r.addCourses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None</p>
                ) : (
                  <ul className="space-y-1">
                    {r.addCourses.map((course) => (
                      <li key={`add-line-${r.requestId}-${course.courseId}`} className="text-sm text-foreground">
                        <span className="font-mono font-semibold">{course.code}</span> - {course.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-rose-700 dark:text-rose-300">
                  Courses to remove
                </p>
                {r.removeCourses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None</p>
                ) : (
                  <ul className="space-y-1">
                    {r.removeCourses.map((course) => (
                      <li
                        key={`remove-line-${r.requestId}-${course.courseId}`}
                        className="text-sm text-foreground"
                      >
                        <span className="font-mono font-semibold">{course.code}</span> - {course.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {r.note ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Instructor note</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{r.note}</p>
              </div>
            ) : null}

            {r.status === "REJECTED" ? (
              <div className="border-l-2 border-destructive/60 pl-3">
                <p className="text-xs font-medium text-destructive">Rejection reason</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {r.rejectionReason || "No reason provided."}
                </p>
              </div>
            ) : null}

            {r.status === "PENDING" ? (
              <div className="space-y-2">
                <Label htmlFor={`cmr-reject-${r.requestId}`} className="text-xs text-muted-foreground">
                  Optional rejection reason
                </Label>
                <Textarea
                  id={`cmr-reject-${r.requestId}`}
                  placeholder="e.g. Please refine the request and resubmit…"
                  value={rejectReasonById[r.requestId] ?? ""}
                  onChange={(e) =>
                    setRejectReasonById((prev) => ({ ...prev, [r.requestId]: e.target.value }))
                  }
                  className="min-h-[72px] resize-y bg-background text-sm"
                />
              </div>
            ) : null}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function CourseModificationRequestsPanel({
  onPendingCountChange,
}: {
  onPendingCountChange: (count: number | null) => void;
}) {
  const [status, setStatus] = useState<TabKey>("PENDING");
  const [byTab, setByTab] = useState<Record<TabKey, CourseModificationRequest[] | undefined>>({
    PENDING: undefined,
    APPROVED: undefined,
    REJECTED: undefined,
  });
  const byTabRef = useRef(byTab);
  byTabRef.current = byTab;

  const [listRefreshing, setListRefreshing] = useState(false);
  const [rejectReasonById, setRejectReasonById] = useState<Record<number, string>>({});
  const [actingId, setActingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const rowsForTab = byTab[status];
  const listLoading = rowsForTab === undefined;
  const rows = rowsForTab ?? [];

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.lecturerName.toLowerCase().includes(q) ||
        r.lecturerEmail.toLowerCase().includes(q),
    );
  }, [rows, searchQuery]);

  const fetchTab = useCallback(
    async (tab: TabKey, signal?: AbortSignal): Promise<CourseModificationRequest[]> => {
      const res = await fetch(`/api/course-modification-requests?status=${tab}`, {
        cache: "no-store",
        signal,
        headers: ApiClient.proxyAuthorizationHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load course modification requests.");
      return Array.isArray(data) ? (data as CourseModificationRequest[]) : [];
    },
    [],
  );

  useEffect(() => {
    const tab = status;
    const ac = new AbortController();
    const hadCache = byTabRef.current[tab] !== undefined;
    if (hadCache) setListRefreshing(true);

    void (async () => {
      try {
        const list = await fetchTab(tab, ac.signal);
        if (ac.signal.aborted) return;
        setByTab((prev) => ({ ...prev, [tab]: list }));
      } catch (e) {
        if (ac.signal.aborted) return;
        toast({
          title: "Error",
          description:
            e instanceof Error ? e.message : "Failed to load course modification requests.",
          variant: "destructive",
        });
        setByTab((prev) => ({ ...prev, [tab]: prev[tab] ?? [] }));
      } finally {
        if (!ac.signal.aborted) setListRefreshing(false);
      }
    })();

    return () => {
      ac.abort();
      setListRefreshing(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, fetchTab]);

  useEffect(() => {
    setSearchQuery("");
  }, [status]);

  useEffect(() => {
    onPendingCountChange(byTab.PENDING ? byTab.PENDING.length : null);
  }, [byTab.PENDING, onPendingCountChange]);

  const approve = async (id: number) => {
    setActingId(id);
    try {
      const res = await fetch(`/api/course-modification-requests/${id}/approve`, {
        method: "PATCH",
        headers: ApiClient.proxyAuthorizationHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve request.");
      toast({ title: "Success", description: "Course modification request approved." });
      setByTab((prev) => ({
        ...prev,
        PENDING: prev.PENDING?.filter((r) => r.requestId !== id),
        APPROVED: undefined,
      }));
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to approve request.",
        variant: "destructive",
      });
    } finally {
      setActingId(null);
    }
  };

  const reject = async (id: number) => {
    setActingId(id);
    try {
      const res = await fetch(`/api/course-modification-requests/${id}/reject`, {
        method: "PATCH",
        headers: {
          ...ApiClient.proxyAuthorizationHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: rejectReasonById[id] || "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject request.");
      toast({ title: "Success", description: "Course modification request rejected." });
      setByTab((prev) => ({
        ...prev,
        PENDING: prev.PENDING?.filter((r) => r.requestId !== id),
        REJECTED: undefined,
      }));
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to reject request.",
        variant: "destructive",
      });
    } finally {
      setActingId(null);
    }
  };

  const statusLabel =
    status === "PENDING" ? "Pending" : status === "APPROVED" ? "Approved" : "Rejected";

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <CardHeader className="space-y-3 border-b border-border/60 bg-muted/20 py-3 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight">
            <span>
              {statusLabel} requests
              <span className="ml-2 text-base font-normal text-muted-foreground">
                {listLoading
                  ? "(…)"
                  : `(${filteredRows.length}${
                      searchQuery.trim() && filteredRows.length !== rows.length
                        ? ` · ${rows.length} total`
                        : ""
                    })`}
              </span>
            </span>
            {listRefreshing && !listLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
            ) : null}
            <span className="sr-only" aria-live="polite">
              {listRefreshing && !listLoading ? "Refreshing list" : ""}
            </span>
          </CardTitle>
          <Tabs value={status} onValueChange={(v) => setStatus(v as TabKey)}>
            <TabsList>
              <TabsTrigger value="PENDING">Pending</TabsTrigger>
              <TabsTrigger value="APPROVED">Approved</TabsTrigger>
              <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Search by name or email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9"
            aria-label="Search requests by name or email"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {listLoading ? <p className="p-4 text-sm text-muted-foreground">Loading…</p> : null}
        {!listLoading && rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No requests found.</p>
        ) : null}
        {!listLoading && rows.length > 0 && filteredRows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No requests match your search.</p>
        ) : null}
        {!listLoading && filteredRows.length > 0
          ? filteredRows.map((r) => (
              <CourseModificationRequestRow
                key={r.requestId}
                r={r}
                rejectReasonById={rejectReasonById}
                setRejectReasonById={setRejectReasonById}
                actingId={actingId}
                approve={approve}
                reject={reject}
              />
            ))
          : null}
      </CardContent>
    </Card>
  );
}

function PendingCountBadge({ count }: { count: number | null }) {
  return (
    <Badge
      variant="outline"
      className="ml-1.5 h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]"
    >
      {count == null ? "…" : String(count)}
    </Badge>
  );
}

export default function AccessRequestsPage() {
  const searchParams = useSearchParams();
  const [requestType, setRequestType] = useState<RequestTypeTab>("ACCESS");
  const [accessPendingCount, setAccessPendingCount] = useState<number | null>(null);
  const [coursePendingCount, setCoursePendingCount] = useState<number | null>(null);

  useEffect(() => {
    const type = searchParams.get("type");
    if (type === "ACCESS" || type === "COURSE_MODIFICATION") {
      setRequestType(type);
    }
  }, [searchParams]);

  return (
    <EntityLayout
      title="Requests"
      description="Manage all lecturer requests in one place."
      headerActions={
        <Tabs value={requestType} onValueChange={(v) => setRequestType(v as RequestTypeTab)}>
          <TabsList>
            <TabsTrigger value="ACCESS">
              Access Requests
              <PendingCountBadge count={accessPendingCount} />
            </TabsTrigger>
            <TabsTrigger value="COURSE_MODIFICATION">
              Course Modification Requests
              <PendingCountBadge count={coursePendingCount} />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <Tabs value={requestType} onValueChange={(v) => setRequestType(v as RequestTypeTab)}>
        <TabsContent value="ACCESS" className="mt-0">
          <AccessRequestsPanel onPendingCountChange={setAccessPendingCount} />
        </TabsContent>
        <TabsContent value="COURSE_MODIFICATION" className="mt-0">
          <CourseModificationRequestsPanel onPendingCountChange={setCoursePendingCount} />
        </TabsContent>
      </Tabs>
    </EntityLayout>
  );
}
