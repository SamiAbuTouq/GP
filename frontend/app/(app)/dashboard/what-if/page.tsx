"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ApiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { academicLevelFromCourseCode } from "@/lib/academic-level";
import useSWR from "swr";
import {
  conditionParameterSummary,
  getScenarios,
  type Condition,
  type Scenario,
  type WhatIfLookupOption,
} from "@/lib/what-if";
import {
  ArrowLeft,
  BookMarked,
  Check,
  ChevronsUpDown,
  Clock,
  DoorOpen,
  GripVertical,
  Layers,
  Maximize2,
  MonitorPlay,
  Eye,
  Copy,
  Pencil,
  Plus,
  SquareMinus,
  SquarePlus,
  Trash2,
  UserMinus,
  UserPlus,
  UserRoundCog,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { departments, slotTypes } from "@/lib/data";

const WHAT_IF_DRAFT_KEY = "whatif_builder_draft_v1";
const TIMESLOT_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"] as const;
const DELIVERY_MODES = ["FACE_TO_FACE", "ONLINE", "BLENDED"] as const;

const INITIAL_DRAFT_PARAMS: Record<string, unknown> = {
  firstName: "",
  lastName: "",
  deptId: "1",
  maxWorkload: 15,
  teachableCourseIds: [] as string[],
  lecturerUserId: "",
  roomId: "",
  newCapacity: 30,
  roomNumber: "",
  roomType: 1,
  capacity: 30,
  isAvailable: true,
  courseId: "",
  newSectionsNormal: 1,
  newSectionsSummer: 0,
  newDeliveryMode: "FACE_TO_FACE",
  startTime: "",
  endTime: "",
  days: [] as string[],
  slotType: "Traditional Lecture",
  isSummer: false,
  courseCode: "",
  courseName: "",
  academicLevel: 1,
  isLab: false,
  creditHours: 3,
  sectionsNormal: 1,
  sectionsSummer: 0,
  assignableLecturerIds: [] as string[],
  slotId: "",
};

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "applied") return "default";
  if (status === "active") return "secondary";
  return "outline";
}

function relativeTime(value?: string | null): string {
  if (!value) return "Never run";
  const date = new Date(value);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type WhatIfConditionType =
  | "add_lecturer"
  | "delete_lecturer"
  | "amend_lecturer"
  | "add_room"
  | "delete_room"
  | "adjust_room_capacity"
  | "add_course"
  | "change_section_count"
  | "change_delivery_mode"
  | "add_timeslot"
  | "delete_timeslot";

const CONDITION_CATALOG: Array<{
  value: WhatIfConditionType;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  { value: "add_lecturer", label: "Add Lecturer", description: "Add a new lecturer to the department", icon: UserPlus },
  { value: "delete_lecturer", label: "Remove Lecturer", description: "Remove an existing lecturer", icon: UserMinus },
  { value: "amend_lecturer", label: "Amend Lecturer", description: "Update a lecturer's workload or courses", icon: UserRoundCog },
  { value: "add_room", label: "Add Room", description: "Add a new room to the university", icon: SquarePlus },
  { value: "delete_room", label: "Remove Room", description: "Remove an existing room", icon: SquareMinus },
  { value: "adjust_room_capacity", label: "Adjust Room Capacity", description: "Change the capacity of a room", icon: Maximize2 },
  { value: "add_course", label: "Add Course", description: "Add a new course offering", icon: BookMarked },
  { value: "change_section_count", label: "Change Section Count", description: "Change how many sections a course runs", icon: Layers },
  { value: "change_delivery_mode", label: "Change Delivery Mode", description: "Switch online, face-to-face, or blended", icon: MonitorPlay },
  { value: "add_timeslot", label: "Add Timeslot", description: "Add an available time window", icon: Clock },
  { value: "delete_timeslot", label: "Remove Timeslot", description: "Remove an existing timeslot", icon: SquareMinus },
];

function catalogMeta(type: WhatIfConditionType) {
  return CONDITION_CATALOG.find((c) => c.value === type) ?? CONDITION_CATALOG[0];
}

function deliveryModeLabel(mode: string): string {
  return mode
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function numericString(value: unknown): string | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? String(n) : null;
}

function conditionParamId(parameters: Record<string, unknown>, key: string): string | null {
  const raw = parameters[key];
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return String(raw);
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return String(parsed);
  }
  return null;
}

function firstArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const candidate = obj.items ?? obj.data ?? obj.rows ?? obj.results ?? obj.courses ?? obj.lecturers ?? obj.rooms ?? obj.timeslots;
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function maskToDays(mask: number): string[] {
  const safe = Number.isFinite(mask) ? mask : 0;
  return TIMESLOT_DAYS.filter((_, i) => (safe & (1 << i)) !== 0);
}

function SearchableSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: WhatIfLookupOption[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value);
  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [options, query]);
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between">
          <span className="truncate text-left">{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent portalled={false} className="z-[260] w-[var(--radix-popover-trigger-width)] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={`Search ${placeholder.toLowerCase()}...`}
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {filteredOptions.map((opt) => (
              <CommandItem
                key={opt.value}
                value={`${opt.label} ${opt.value}`}
                onSelect={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <Check className={`mr-2 h-4 w-4 ${value === opt.value ? "opacity-100" : "opacity-0"}`} />
                {opt.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function MultiSelectChecklist({
  title,
  options,
  values,
  onChange,
  placeholder = "Search...",
}: {
  title: string;
  options: WhatIfLookupOption[];
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [options, query]);

  function toggle(v: string) {
    if (values.includes(v)) onChange(values.filter((x) => x !== v));
    else onChange([...values, v]);
  }

  return (
    <div className="space-y-2">
      <Label className="font-semibold">{title}</Label>
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} />
      <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border p-2">
        {filtered.length === 0 ? <p className="px-1 py-2 text-xs text-muted-foreground">No matches</p> : null}
        {filtered.map((opt) => (
          <label key={opt.value} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-muted/60">
            <Checkbox checked={values.includes(opt.value)} onCheckedChange={() => toggle(opt.value)} />
            <span className="text-sm">{opt.label}</span>
          </label>
        ))}
      </div>
      {values.length ? <p className="text-xs text-muted-foreground">{values.length} selected</p> : null}
    </div>
  );
}

export default function WhatIfScenariosPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Scenario | null>(null);
  const [forceDelete, setForceDelete] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"latest" | "name">("latest");
  const [draftRecovered, setDraftRecovered] = useState(false);
  const [lecturerOptions, setLecturerOptions] = useState<WhatIfLookupOption[]>([]);
  const [roomOptions, setRoomOptions] = useState<WhatIfLookupOption[]>([]);
  const [courseOptions, setCourseOptions] = useState<WhatIfLookupOption[]>([]);
  const [timeslotOptions, setTimeslotOptions] = useState<WhatIfLookupOption[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(false);
  const [draftParams, setDraftParams] = useState<Record<string, unknown>>(() => ({ ...INITIAL_DRAFT_PARAMS }));
  type BuilderStep = "scenario" | "chooseCondition" | "conditionForm";
  const [builderStep, setBuilderStep] = useState<BuilderStep>("scenario");
  const [conditionFormSource, setConditionFormSource] = useState<"picker" | "list-edit">("picker");
  const [editingConditionIndex, setEditingConditionIndex] = useState<number | null>(null);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [conditionType, setConditionType] = useState<WhatIfConditionType>("add_lecturer");
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [initialFormState, setInitialFormState] = useState<{ name: string; description: string; conditions: Condition[] }>({
    name: "",
    description: "",
    conditions: [],
  });

  const isDirty = useMemo(() => {
    const current = JSON.stringify({ name, description, conditions });
    const initial = JSON.stringify(initialFormState);
    return current !== initial;
  }, [name, description, conditions, initialFormState]);

  const { data: runServerStatus } = useSWR<{ running: boolean; globalLockOwner?: "timetable" | "whatif" | null }>(
    "/api/run",
    async (url: string) => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    },
    { refreshInterval: 1500, dedupingInterval: 0 },
  );

  const hasWhatIfGlobalRun = Boolean(runServerStatus?.running && runServerStatus?.globalLockOwner === "whatif");
  const activeRunningScenarioId = useMemo(() => {
    if (!hasWhatIfGlobalRun) return null;
    const candidates = scenarios.filter(
      (s) => Boolean(s.isRunning) || s.latestRun?.status === "running" || s.latestRun?.status === "pending",
    );
    if (!candidates.length) return null;
    const sorted = [...candidates].sort((a, b) => {
      const ad = new Date(a.latestRun?.startedAt ?? 0).getTime();
      const bd = new Date(b.latestRun?.startedAt ?? 0).getTime();
      return bd - ad;
    });
    return sorted[0]?.id ?? null;
  }, [scenarios, hasWhatIfGlobalRun]);

  function requestCloseBuilder() {
    if (isDirty) {
      setDiscardConfirmOpen(true);
      return;
    }
    setDrawerOpen(false);
  }

  async function load() {
    setLoading(true);
    try {
      setScenarios(await getScenarios());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((error: unknown) => {
      toast({ title: "Failed to load scenarios", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    });
  }, []);

  useEffect(() => {
    if (!drawerOpen || editingId) return;
    const payload = { name, description, conditions };
    window.localStorage.setItem(WHAT_IF_DRAFT_KEY, JSON.stringify(payload));
  }, [drawerOpen, editingId, name, description, conditions]);

  useEffect(() => {
    if (!drawerOpen) return;
    setLoadingLookups(true);
    const safeJson = async (url: string, fallback: unknown) => {
      try {
        const r = await fetch(url);
        if (!r.ok) return fallback;
        return await r.json();
      } catch {
        return fallback;
      }
    };

    Promise.all([
      safeJson("/api/lecturers", []),
      safeJson("/api/rooms", []),
      safeJson("/api/courses/catalog", { courses: [] }),
      safeJson("/api/timeslots", []),
    ])
      .then(([lecturers, rooms, coursesRes, timeslots]) => {
        const nextLecturers: WhatIfLookupOption[] = firstArray(lecturers)
          .map((l: any) => {
            const value = numericString(
              l.databaseId ??
              l.database_id ??
              l.userId ??
              l.user_id ??
              l.lecturerUserId ??
              l.lecturer_user_id ??
              l.id,
            );
            if (!value) return null;
            return {
              value,
              label: String(l.name ?? l.email ?? l.id ?? "Lecturer"),
            };
          })
          .filter((x): x is WhatIfLookupOption => x !== null);
        const nextRooms: WhatIfLookupOption[] = firstArray(rooms)
          .map((r: any) => {
            const value = numericString(
              r.databaseId ??
              r.database_id ??
              r.roomId ??
              r.room_id ??
              r.id,
            );
            if (!value) return null;
            const roomName = String(r.roomNumber ?? r.room_number ?? r.name ?? r.id ?? "Room");
            const roomType = String(r.type ?? r.roomType ?? r.room_type ?? "Room");
            return {
              value,
              label: `${roomName} (${roomType})`,
            };
          })
          .filter((x): x is WhatIfLookupOption => x !== null);
        const courses = firstArray(coursesRes);
        const nextCourses: WhatIfLookupOption[] = courses
          .map((c: any) => {
            const value = numericString(c.id ?? c.course_id ?? c.courseId);
            if (!value) return null;
            const code = String(c.code ?? c.course_code ?? c.courseCode ?? "").trim();
            const name = String(c.name ?? c.course_name ?? c.courseName ?? "").trim();
            const label = [code, name].filter(Boolean).join(" - ");
            return {
              value,
              label: label || `Course ${value}`,
            };
          })
          .filter((x): x is WhatIfLookupOption => x !== null);
        const nextSlots: WhatIfLookupOption[] = firstArray(timeslots)
          .map((t: any) => {
            const value = numericString(t.id ?? t.slotId ?? t.slot_id);
            if (!value) return null;
            const start = String(t.start ?? t.startTime ?? t.start_time ?? "");
            const end = String(t.end ?? t.endTime ?? t.end_time ?? "");
            const daysRaw = Array.isArray(t.days)
              ? t.days
              : Array.isArray(t.dayNames)
                ? t.dayNames
                : [];
            const days = daysRaw.map((d: unknown) => String(d)).join(" ");
            const slotType = String(t.slotType ?? t.slot_type ?? t.type ?? "");
            return {
              value,
              label: `${start} - ${end} | ${days} | ${slotType}`,
            };
          })
          .filter((x): x is WhatIfLookupOption => x !== null);
        setLecturerOptions(nextLecturers);
        setRoomOptions(nextRooms);
        setCourseOptions(nextCourses);
        setTimeslotOptions(nextSlots);
      })
      .finally(() => setLoadingLookups(false));
  }, [drawerOpen]);

  function openCreate() {
    const clean = { name: "", description: "", conditions: [] as Condition[] };
    setEditingId(null);
    setName(clean.name);
    setDescription(clean.description);
    setConditions(clean.conditions);
    setInitialFormState(clean);
    setDraftParams({ ...INITIAL_DRAFT_PARAMS });
    setDraftRecovered(false);
    window.localStorage.removeItem(WHAT_IF_DRAFT_KEY);
    setBuilderStep("scenario");
    setEditingConditionIndex(null);
    setDrawerOpen(true);
  }

  function openEdit(s: Scenario) {
    const baseline = { name: s.name, description: s.description ?? "", conditions: s.conditions ?? [] };
    setEditingId(s.id);
    setName(baseline.name);
    setDescription(baseline.description);
    setConditions(baseline.conditions);
    setInitialFormState(baseline);
    setDraftParams({ ...INITIAL_DRAFT_PARAMS });
    setBuilderStep("scenario");
    setEditingConditionIndex(null);
    setDrawerOpen(true);
  }

  const editQueryConsumed = useRef(false);
  useEffect(() => {
    const raw = searchParams.get("edit");
    if (!raw) {
      editQueryConsumed.current = false;
      return;
    }
    if (loading || editQueryConsumed.current) return;
    editQueryConsumed.current = true;
    const editId = Number(raw);
    if (!Number.isFinite(editId)) {
      router.replace("/dashboard/what-if");
      editQueryConsumed.current = false;
      return;
    }
    const s = scenarios.find((x) => x.id === editId);
    router.replace("/dashboard/what-if");
    if (s) openEdit(s);
  }, [loading, scenarios, searchParams, router]);

  useEffect(() => {
    if (!drawerOpen) {
      setBuilderStep("scenario");
      setEditingConditionIndex(null);
      setDragFromIndex(null);
    }
  }, [drawerOpen]);

  function setParam(key: string, value: unknown) {
    setDraftParams((prev) => ({ ...prev, [key]: value }));
  }

  function getParamString(key: string): string {
    const v = draftParams[key];
    return typeof v === "string" ? v : "";
  }

  function getParamNumber(key: string, fallback = 0): number {
    const v = draftParams[key];
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    }
    return fallback;
  }

  function getParamStringArray(key: string): string[] {
    const v = draftParams[key];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  }

  function loadConditionIntoDraft(c: Condition) {
    setConditionType(c.type as WhatIfConditionType);
    const p = c.parameters as Record<string, unknown>;
    const base = { ...INITIAL_DRAFT_PARAMS };
    const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
    const str = (v: unknown) => (v != null ? String(v) : "");
    const idsStr = (v: unknown) =>
      Array.isArray(v) ? (v as unknown[]).filter((x): x is number | string => x != null).map(String) : [];

    switch (c.type) {
      case "add_lecturer":
        setDraftParams({
          ...base,
          firstName: str(p.firstName),
          lastName: str(p.lastName),
          deptId: str(p.deptId) || "1",
          maxWorkload: num(p.maxWorkload, 15),
          teachableCourseIds: idsStr(p.teachableCourseIds),
        });
        break;
      case "delete_lecturer":
      case "amend_lecturer":
        setDraftParams({
          ...base,
          lecturerUserId: str(p.lecturerUserId),
          maxWorkload: p.maxWorkload != null ? num(p.maxWorkload, 0) : 0,
          teachableCourseIds: idsStr(p.teachableCourseIds),
        });
        break;
      case "add_room":
        setDraftParams({
          ...base,
          roomNumber: str(p.roomNumber),
          roomType: num(p.roomType, 1),
          capacity: num(p.capacity, 30),
          isAvailable: p.isAvailable !== false,
        });
        break;
      case "delete_room":
      case "adjust_room_capacity":
        setDraftParams({
          ...base,
          roomId: str(p.roomId),
          newCapacity: num(p.newCapacity, 30),
        });
        break;
      case "add_course":
        setDraftParams({
          ...base,
          courseCode: str(p.courseCode),
          courseName: str(p.courseName),
          deptId: str(p.deptId) || "1",
          academicLevel: num(p.academicLevel, academicLevelFromCourseCode(str(p.courseCode))),
          isLab: Boolean(p.isLab),
          creditHours: num(p.creditHours, 3),
          newDeliveryMode: str(p.deliveryMode) || "FACE_TO_FACE",
          sectionsNormal: num(p.sectionsNormal, 1),
          sectionsSummer: num(p.sectionsSummer, 0),
          assignableLecturerIds: idsStr(p.assignableLecturerIds),
        });
        break;
      case "change_section_count":
        setDraftParams({
          ...base,
          courseId: str(p.courseId),
          newSectionsNormal: num(p.newSectionsNormal, 1),
          newSectionsSummer: num(p.newSectionsSummer, 0),
        });
        break;
      case "change_delivery_mode":
        setDraftParams({
          ...base,
          courseId: str(p.courseId),
          newDeliveryMode: str(p.newDeliveryMode ?? p.deliveryMode) || "FACE_TO_FACE",
        });
        break;
      case "add_timeslot":
        setDraftParams({
          ...base,
          startTime: str(p.startTime),
          endTime: str(p.endTime),
          days: Array.isArray(p.days)
            ? (p.days as unknown[]).filter((d): d is string => typeof d === "string")
            : maskToDays(num(p.daysMask, 0)),
          slotType: str(p.slotType) || "Traditional Lecture",
          isSummer: Boolean(p.isSummer),
        });
        break;
      case "delete_timeslot":
        setDraftParams({ ...base, slotId: str(p.slotId) });
        break;
      default:
        setDraftParams({ ...base });
    }
  }

  function tryBuildCurrentCondition(): Condition | null {
    const p = draftParams;
    let parameters: Record<string, unknown> = {};

    switch (conditionType) {
      case "add_lecturer": {
        const firstName = getParamString("firstName").trim();
        const lastName = getParamString("lastName").trim();
        const deptId = getParamNumber("deptId", 0);
        if (!firstName || !lastName) {
          toast({ title: "Add lecturer", description: "Enter first and last name.", variant: "destructive" });
          return null;
        }
        if (deptId < 1) {
          toast({ title: "Add lecturer", description: "Select a department.", variant: "destructive" });
          return null;
        }
        parameters = {
          firstName,
          lastName,
          deptId,
          maxWorkload: getParamNumber("maxWorkload", 15),
          teachableCourseIds: getParamStringArray("teachableCourseIds").map(Number).filter((n) => n > 0),
        };
        break;
      }
      case "delete_lecturer":
        if (!getParamString("lecturerUserId") || getParamNumber("lecturerUserId", 0) < 1) {
          toast({ title: "Remove lecturer", description: "Select a lecturer from the list.", variant: "destructive" });
          return null;
        }
        parameters = { lecturerUserId: getParamNumber("lecturerUserId") };
        break;
      case "amend_lecturer":
        if (!getParamString("lecturerUserId") || getParamNumber("lecturerUserId", 0) < 1) {
          toast({ title: "Amend lecturer", description: "Select a lecturer from the list.", variant: "destructive" });
          return null;
        }
        parameters = {
          lecturerUserId: getParamNumber("lecturerUserId"),
          teachableCourseIds: getParamStringArray("teachableCourseIds").map(Number),
          maxWorkload: getParamNumber("maxWorkload", 0) || undefined,
        };
        break;
      case "add_room":
        if (!getParamString("roomNumber").trim()) {
          toast({ title: "Add room", description: "Enter a room number.", variant: "destructive" });
          return null;
        }
        parameters = {
          roomNumber: getParamString("roomNumber").trim(),
          roomType: getParamNumber("roomType", 1),
          capacity: getParamNumber("capacity", 30),
          isAvailable: true,
        };
        break;
      case "delete_room":
        if (!getParamString("roomId") || getParamNumber("roomId", 0) < 1) {
          toast({ title: "Remove room", description: "Select a room.", variant: "destructive" });
          return null;
        }
        parameters = { roomId: getParamNumber("roomId") };
        break;
      case "adjust_room_capacity":
        if (!getParamString("roomId") || getParamNumber("roomId", 0) < 1) {
          toast({ title: "Adjust capacity", description: "Select a room.", variant: "destructive" });
          return null;
        }
        parameters = {
          roomId: getParamNumber("roomId"),
          newCapacity: getParamNumber("newCapacity", 30),
        };
        break;
      case "add_course":
        if (!getParamString("courseCode").trim() || !getParamString("courseName").trim()) {
          toast({ title: "Add course", description: "Enter course code and name.", variant: "destructive" });
          return null;
        }
        parameters = {
          courseCode: getParamString("courseCode").trim(),
          courseName: getParamString("courseName").trim(),
          deptId: getParamNumber("deptId", 0) || 1,
          academicLevel: academicLevelFromCourseCode(getParamString("courseCode")),
          isLab: Boolean(p.isLab),
          creditHours: getParamNumber("creditHours", 3),
          deliveryMode: getParamString("newDeliveryMode") || "FACE_TO_FACE",
          sectionsNormal: getParamNumber("sectionsNormal", 1),
          sectionsSummer: getParamNumber("sectionsSummer", 0),
          assignableLecturerIds: getParamStringArray("assignableLecturerIds").map(Number).filter((n) => n > 0),
        };
        break;
      case "change_section_count":
        if (!getParamString("courseId") || getParamNumber("courseId", 0) < 1) {
          toast({ title: "Section count", description: "Select a course.", variant: "destructive" });
          return null;
        }
        parameters = {
          courseId: getParamNumber("courseId"),
          newSectionsNormal: getParamNumber("newSectionsNormal", 1),
          newSectionsSummer: getParamNumber("newSectionsSummer", 0),
        };
        break;
      case "change_delivery_mode":
        if (!getParamString("courseId") || getParamNumber("courseId", 0) < 1) {
          toast({ title: "Delivery mode", description: "Select a course.", variant: "destructive" });
          return null;
        }
        // Include both keys for backward compatibility with older runner payloads.
        const selectedDeliveryMode = getParamString("newDeliveryMode") || "FACE_TO_FACE";
        parameters = {
          courseId: getParamNumber("courseId"),
          newDeliveryMode: selectedDeliveryMode,
          deliveryMode: selectedDeliveryMode,
        };
        break;
      case "add_timeslot":
        if (!getParamString("startTime") || !getParamString("endTime")) {
          toast({ title: "Add timeslot", description: "Set start and end time.", variant: "destructive" });
          return null;
        }
        if (getParamStringArray("days").length === 0) {
          toast({ title: "Add timeslot", description: "Select at least one day.", variant: "destructive" });
          return null;
        }
        parameters = {
          startTime: getParamString("startTime"),
          endTime: getParamString("endTime"),
          days: getParamStringArray("days"),
          slotType: getParamString("slotType") || "Traditional Lecture",
          isSummer: Boolean(p.isSummer),
        };
        break;
      case "delete_timeslot":
        if (!getParamString("slotId") || getParamNumber("slotId", 0) < 1) {
          toast({ title: "Remove timeslot", description: "Select a timeslot.", variant: "destructive" });
          return null;
        }
        parameters = { slotId: getParamNumber("slotId") };
        break;
    }
    return { type: conditionType, parameters };
  }

  function commitConditionForm() {
    const built = tryBuildCurrentCondition();
    if (!built) return;
    if (editingConditionIndex !== null) {
      setConditions((prev) => prev.map((c, i) => (i === editingConditionIndex ? built : c)));
    } else {
      setConditions((prev) => [...prev, built]);
    }
    setBuilderStep("scenario");
    setEditingConditionIndex(null);
    setDraftParams({ ...INITIAL_DRAFT_PARAMS });
  }

  function reorderConditions(from: number, to: number) {
    if (from === to) return;
    setConditions((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  async function save(runAfterSave: boolean, opts?: { closeModal?: boolean; quiet?: boolean }) {
    if (!name.trim()) {
      toast({ title: "Name required", description: "Enter a scenario name.", variant: "destructive" });
      return;
    }
    const closeModal = opts?.closeModal !== false;
    const body = { name: name.trim(), description: description.trim(), conditions };
    const endpoint = editingId ? `/what-if/scenarios/${editingId}` : "/what-if/scenarios";
    const method = editingId ? "PATCH" : "POST";
    const saved = await ApiClient.request<Scenario>(endpoint, { method, body: JSON.stringify(body) });
    if (!opts?.quiet) {
    toast({ title: editingId ? "Scenario updated" : "Scenario created" });
    }
    if (closeModal) {
    setDrawerOpen(false);
    if (!editingId) window.localStorage.removeItem(WHAT_IF_DRAFT_KEY);
    } else if (!editingId && saved?.id) {
      setEditingId(saved.id);
    }
    await load();
    if (runAfterSave) window.location.href = `/dashboard/what-if/${saved.id}`;
  }

  async function saveDraft() {
    window.localStorage.setItem(WHAT_IF_DRAFT_KEY, JSON.stringify({ name, description, conditions }));
    if (!name.trim()) {
      toast({ title: "Draft saved locally", description: "Add a name to sync this scenario to the server." });
      return;
    }
    await save(false, { closeModal: true, quiet: true });
    toast({ title: "Draft saved", description: "Your scenario is stored on the server." });
  }

  const conflicts = useMemo(() => {
    const issues: string[] = [];
    const seen = new Map<string, number>();
    for (const c of conditions) {
      const key = `${c.type}:${JSON.stringify(c.parameters)}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    for (const [key, count] of seen.entries()) {
      if (count > 1) issues.push(`Duplicate condition detected (${key}).`);
    }
    const deletedLecturers = new Set<number>();
    const amendedLecturers = new Set<number>();
    const deletedRooms = new Set<number>();
    const adjustedRooms = new Set<number>();
    for (const c of conditions) {
      const p = c.parameters as Record<string, unknown>;
      if (c.type === "delete_lecturer" && typeof p.lecturerUserId === "number") deletedLecturers.add(p.lecturerUserId);
      if (c.type === "amend_lecturer" && typeof p.lecturerUserId === "number") amendedLecturers.add(p.lecturerUserId);
      if (c.type === "delete_room" && typeof p.roomId === "number") deletedRooms.add(p.roomId);
      if (c.type === "adjust_room_capacity" && typeof p.roomId === "number") adjustedRooms.add(p.roomId);
    }
    for (const id of deletedLecturers) if (amendedLecturers.has(id)) issues.push(`Lecturer ${id} is both deleted and amended.`);
    for (const id of deletedRooms) if (adjustedRooms.has(id)) issues.push(`Room ${id} is both deleted and capacity-adjusted.`);
    return issues;
  }, [conditions]);

  const conditionsForLookupFiltering = useMemo(() => {
    if (editingConditionIndex === null) return conditions;
    return conditions.filter((_, idx) => idx !== editingConditionIndex);
  }, [conditions, editingConditionIndex]);

  const { deletedLecturerIds, deletedRoomIds, deletedTimeslotIds } = useMemo(() => {
    const nextDeletedLecturerIds = new Set<string>();
    const nextDeletedRoomIds = new Set<string>();
    const nextDeletedTimeslotIds = new Set<string>();

    for (const condition of conditionsForLookupFiltering) {
      const parameters = condition.parameters as Record<string, unknown>;
      if (condition.type === "delete_lecturer") {
        const id = conditionParamId(parameters, "lecturerUserId");
        if (id) nextDeletedLecturerIds.add(id);
      }
      if (condition.type === "delete_room") {
        const id = conditionParamId(parameters, "roomId");
        if (id) nextDeletedRoomIds.add(id);
      }
      if (condition.type === "delete_timeslot") {
        const id = conditionParamId(parameters, "slotId");
        if (id) nextDeletedTimeslotIds.add(id);
      }
    }

    return {
      deletedLecturerIds: nextDeletedLecturerIds,
      deletedRoomIds: nextDeletedRoomIds,
      deletedTimeslotIds: nextDeletedTimeslotIds,
    };
  }, [conditionsForLookupFiltering]);

  const selectableDeleteLecturerOptions = useMemo(
    () => lecturerOptions.filter((option) => !deletedLecturerIds.has(option.value)),
    [lecturerOptions, deletedLecturerIds],
  );
  const selectableAmendLecturerOptions = useMemo(
    () => lecturerOptions.filter((option) => !deletedLecturerIds.has(option.value)),
    [lecturerOptions, deletedLecturerIds],
  );
  const selectableDeleteRoomOptions = useMemo(
    () => roomOptions.filter((option) => !deletedRoomIds.has(option.value)),
    [roomOptions, deletedRoomIds],
  );
  const selectableAdjustRoomOptions = useMemo(
    () => roomOptions.filter((option) => !deletedRoomIds.has(option.value)),
    [roomOptions, deletedRoomIds],
  );
  const selectableDeleteTimeslotOptions = useMemo(
    () => timeslotOptions.filter((option) => !deletedTimeslotIds.has(option.value)),
    [timeslotOptions, deletedTimeslotIds],
  );

  const visibleScenarios = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = scenarios.filter((s) => {
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
    });
    rows = [...rows].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);

      const aStartedAt = a.latestRun?.startedAt ? new Date(a.latestRun.startedAt).getTime() : 0;
      const bStartedAt = b.latestRun?.startedAt ? new Date(b.latestRun.startedAt).getTime() : 0;
      if (aStartedAt !== bStartedAt) return bStartedAt - aStartedAt;

      // When scenarios have no runs (or same run timestamp), use newest scenario first.
      return b.id - a.id;
    });
    return rows;
  }, [scenarios, search, sortBy]);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="mx-auto w-full max-w-[1680px] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">What-If Scenarios</h1>
                <p className="text-sm text-muted-foreground">Simulate timetable changes in an isolated sandbox before applying them.</p>
              </div>
              <div className="flex gap-2">
                {scenarios.filter((s) => s.latestRun?.status === "completed" || s.latestRun?.status === "applied").length >= 2 ? (
                  <Button variant="outline" onClick={() => router.push("/dashboard/what-if/compare")}>Compare Runs</Button>
                ) : null}
                <Button onClick={openCreate}>New Scenario</Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search scenarios..."
                className="h-9 w-full sm:max-w-xs"
              />
              <div className="ml-auto flex gap-1">
                <Button size="sm" variant={sortBy === "latest" ? "default" : "outline"} onClick={() => setSortBy("latest")}>Latest</Button>
                <Button size="sm" variant={sortBy === "name" ? "default" : "outline"} onClick={() => setSortBy("name")}>Name</Button>
              </div>
            </div>

            {loading ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3].map((n) => <Card key={n} className="h-44 animate-pulse bg-muted/40" />)}
              </div>
            ) : visibleScenarios.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <p className="text-muted-foreground">No scenarios yet. Create one to start simulating changes.</p>
                  <p className="mt-2 text-xs text-muted-foreground">Create scenario → add conditions → run simulation → apply if outcome is better.</p>
                  <Button className="mt-4" onClick={openCreate}>New Scenario</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {visibleScenarios.map((s) => (
                  <Card key={s.id} className="gap-0 overflow-hidden border-border/70 py-3">
                    <div
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer rounded-sm outline-none transition-colors hover:bg-muted/20 focus-visible:bg-muted/20"
                      onClick={() => router.push(`/dashboard/what-if/${s.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/dashboard/what-if/${s.id}`);
                        }
                      }}
                    >
                      <CardHeader className="space-y-0.5 px-3.5 pb-0.5 pt-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-0.5">
                            <CardTitle className="line-clamp-1 text-base leading-tight">{s.name}</CardTitle>
                            <CardDescription className="line-clamp-1 text-xs text-muted-foreground">
                              {s.description || "No description"}
                            </CardDescription>
                          </div>
                          <Badge
                            variant={statusVariant(s.status)}
                            className="h-6 rounded-full px-2.5 text-xs font-medium capitalize"
                          >
                            {s.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-1.5 px-3.5 pb-2 pt-0 text-sm">
                      <p className="text-xs text-muted-foreground">{s.conditionCount} conditions</p>
                      <p className="text-xs text-muted-foreground">
                        {(() => {
                          if (!s.latestRun) return "Never run";
                          const latestStatus = s.latestRun.status;
                          const isReportedRunning = latestStatus === "running" || latestStatus === "pending" || Boolean(s.isRunning);
                          if (isReportedRunning) {
                            if (hasWhatIfGlobalRun && activeRunningScenarioId === s.id) {
                              return `Last run ${relativeTime(s.latestRun.startedAt)} - ${latestStatus}`;
                            }
                            return `Last run ${relativeTime(s.latestRun.startedAt)} - status syncing`;
                          }
                          return `Last run ${relativeTime(s.latestRun.startedAt)} - ${latestStatus}`;
                        })()}
                      </p>
                        <div className="border-t pt-1.5" />
                      </CardContent>
                    </div>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap justify-center gap-1.5">
                        <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" onClick={() => openEdit(s)}>
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2.5 text-xs"
                          onClick={async () => {
                            await ApiClient.request(`/what-if/scenarios/${s.id}/clone`, { method: "POST" });
                            toast({ title: "Scenario cloned" });
                            await load();
                          }}
                        >
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          Clone
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" onClick={() => router.push(`/dashboard/what-if/${s.id}/runs`)}>
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          View Runs
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => { setForceDelete(false); setDeleteTarget(s); }}>
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <Sheet
        open={drawerOpen}
        onOpenChange={(open) => {
          if (open) {
            setDrawerOpen(true);
            return;
          }
          requestCloseBuilder();
        }}
      >
        <SheetContent side="right" className="w-[92vw] max-w-3xl p-0 sm:w-[760px] sm:max-w-[760px]">
          {builderStep === "scenario" ? (
            <>
              <DialogHeader className="space-y-1 border-b px-6 py-4 pr-14 text-left">
                <DialogTitle className="text-xl">{editingId ? "Edit Scenario" : "New Scenario"}</DialogTitle>
                <DialogDescription>Define what changes to simulate. GWO will reschedule around each change.</DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {draftRecovered ? <p className="text-xs text-muted-foreground">Recovered draft loaded. Saving will replace it.</p> : null}
                <div className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-sky-600/80 dark:text-sky-400/80">Scenario info</p>
                  <div className="space-y-2">
                    <Label className="font-medium">Name</Label>
                    <Input
                      value={name}
                      maxLength={100}
                      placeholder="e.g. Add 3 sections of CS101"
                      onChange={(e) => setName(e.target.value)}
                    />
            </div>
                  <div className="space-y-2">
                    <Label className="font-medium">Description (Optional)</Label>
                    <Textarea
                      value={description}
                      placeholder="Details about what this scenario is testing…"
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                    />
            </div>
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-sky-600/80 dark:text-sky-400/80">What-if conditions</p>
                  {conditions.length === 0 ? (
                    <div className="flex min-h-[120px] flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
                      No conditions added yet.
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {conditions.map((c, idx) => (
                        <li
                          key={`${c.type}-${idx}`}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (dragFromIndex !== null) reorderConditions(dragFromIndex, idx);
                            setDragFromIndex(null);
                          }}
                          className={cn(
                            "flex items-start gap-2 rounded-lg border bg-card p-3 text-sm shadow-sm",
                            dragFromIndex === idx && "opacity-60",
                          )}
                        >
                          <button
                            type="button"
                            draggable
                            onDragStart={() => setDragFromIndex(idx)}
                            onDragEnd={() => setDragFromIndex(null)}
                            className="mt-0.5 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
                            aria-label="Reorder"
                          >
                            <GripVertical className="h-5 w-5" />
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold">{catalogMeta(c.type as WhatIfConditionType).label}</div>
                            <div className="mt-0.5 break-words text-xs text-muted-foreground">
                              {conditionParameterSummary(c, { lecturerOptions, roomOptions, courseOptions, timeslotOptions })}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-0.5">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="text-sky-600 hover:bg-sky-50 hover:text-sky-700 dark:hover:bg-sky-950/50"
                              onClick={() => {
                                loadConditionIntoDraft(c);
                                setConditionFormSource("list-edit");
                                setEditingConditionIndex(idx);
                                setBuilderStep("conditionForm");
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                              onClick={() => setConditions((prev) => prev.filter((_, i) => i !== idx))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-dashed border-muted-foreground/40 py-6 text-muted-foreground hover:bg-muted/40"
                    onClick={() => setBuilderStep("chooseCondition")}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Condition
                  </Button>
                  {conflicts.length > 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                      <p className="mb-1 font-medium">Configuration warnings</p>
                      {conflicts.map((issue) => (
                        <p key={issue}>
                          — {issue}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-background px-6 py-4">
                <Button type="button" variant="outline" onClick={requestCloseBuilder}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => void saveDraft().catch((e: unknown) => toast({ title: "Could not save draft", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" }))}
                >
                  Save Draft
                </Button>
                <Button type="button" onClick={() => void save(true)} disabled={!name.trim() || conditions.length === 0}>
                  Save &amp; Run
                </Button>
              </div>
            </>
          ) : null}

          {builderStep === "chooseCondition" ? (
            <>
              <div className="flex items-center gap-2 border-b px-4 py-3 pr-14">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setBuilderStep("scenario")}
                  aria-label="Back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <h2 className="text-lg font-semibold">Add Condition</h2>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {CONDITION_CATALOG.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => {
                          setConditionType(item.value);
                          setDraftParams({ ...INITIAL_DRAFT_PARAMS });
                          setConditionFormSource("picker");
                          setEditingConditionIndex(null);
                          setBuilderStep("conditionForm");
                        }}
                        className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center shadow-sm transition-colors hover:border-sky-300/60 hover:bg-sky-50/50 dark:hover:border-sky-700 dark:hover:bg-sky-950/30"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
                          <Icon className="h-6 w-6" />
                        </div>
                        <span className="font-semibold">{item.label}</span>
                        <span className="text-xs text-muted-foreground">{item.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}

          {builderStep === "conditionForm" ? (
            <>
              <div className="flex items-center gap-2 border-b px-4 py-3 pr-14">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => {
                    setDraftParams({ ...INITIAL_DRAFT_PARAMS });
                    setEditingConditionIndex(null);
                    if (conditionFormSource === "picker") setBuilderStep("chooseCondition");
                    else setBuilderStep("scenario");
                  }}
                  aria-label="Back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <h2 className="text-lg font-semibold">{editingConditionIndex !== null ? "Edit Condition" : "Add Condition"}</h2>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {(() => {
                  const meta = catalogMeta(conditionType);
                  const MetaIcon = meta.icon;
                  return (
                    <div className="mb-5 flex gap-3 rounded-lg border bg-muted/30 p-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
                        <MetaIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold">{meta.label}</div>
                        <p className="text-xs text-muted-foreground">{meta.description}</p>
                      </div>
                    </div>
                  );
                })()}
                {loadingLookups ? <p className="mb-4 text-xs text-muted-foreground">Loading searchable data…</p> : null}

              {conditionType === "delete_lecturer" || conditionType === "amend_lecturer" ? (
                  <div className="mb-4 space-y-2">
                    <Label className="font-semibold">Lecturer</Label>
                  <SearchableSelect
                    value={getParamString("lecturerUserId")}
                    onChange={(v) => setParam("lecturerUserId", v)}
                    placeholder="Select lecturer"
                    options={conditionType === "delete_lecturer" ? selectableDeleteLecturerOptions : selectableAmendLecturerOptions}
                  />
                </div>
              ) : null}

                {conditionType === "amend_lecturer" ? (
                  <div className="mb-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label className="font-semibold">Max Workload</Label>
                        <Input className="mt-1.5" type="number" min={1} max={30} value={getParamNumber("maxWorkload", 15)} onChange={(e) => setParam("maxWorkload", Number(e.target.value))} />
                      </div>
                    </div>
                    <MultiSelectChecklist
                      title="Teachable Courses"
                      options={courseOptions}
                      values={getParamStringArray("teachableCourseIds")}
                      onChange={(next) => setParam("teachableCourseIds", next)}
                      placeholder="Search courses by code/name..."
                    />
                  </div>
                ) : null}

              {conditionType === "add_lecturer" ? (
                  <div className="mb-4 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                  <div>
                        <Label className="font-semibold">First Name</Label>
                        <Input className="mt-1.5" value={getParamString("firstName")} onChange={(e) => setParam("firstName", e.target.value)} />
                      </div>
                      <div>
                        <Label className="font-semibold">Last Name</Label>
                        <Input className="mt-1.5" value={getParamString("lastName")} onChange={(e) => setParam("lastName", e.target.value)} />
                      </div>
                      <div>
                        <Label className="font-semibold">Department</Label>
                    <Select value={getParamString("deptId") || "1"} onValueChange={(v) => setParam("deptId", v)}>
                          <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d, i) => (
                          <SelectItem key={d} value={String(i + 1)}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                      <div>
                        <Label className="font-semibold">Max Workload</Label>
                        <Input className="mt-1.5" type="number" min={1} max={30} value={getParamNumber("maxWorkload", 15)} onChange={(e) => setParam("maxWorkload", Number(e.target.value))} />
                      </div>
                    </div>
                    <MultiSelectChecklist
                      title="Teachable Courses"
                      options={courseOptions}
                      values={getParamStringArray("teachableCourseIds")}
                      onChange={(next) => setParam("teachableCourseIds", next)}
                      placeholder="Search courses by code/name..."
                    />
                </div>
              ) : null}

              {conditionType === "delete_room" || conditionType === "adjust_room_capacity" ? (
                  <div className="mb-4 space-y-2">
                    <Label className="font-semibold">Room</Label>
                  <SearchableSelect
                    value={getParamString("roomId")}
                    onChange={(v) => setParam("roomId", v)}
                    placeholder="Select room"
                    options={conditionType === "delete_room" ? selectableDeleteRoomOptions : selectableAdjustRoomOptions}
                  />
                </div>
              ) : null}

              {conditionType === "add_room" ? (
                  <div className="mb-4 space-y-4">
                    <div>
                      <Label className="font-semibold">Room Number / Name</Label>
                      <Input className="mt-1.5" value={getParamString("roomNumber")} onChange={(e) => setParam("roomNumber", e.target.value)} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label className="font-semibold">Capacity</Label>
                        <Input className="mt-1.5" type="number" min={1} value={getParamNumber("capacity", 30)} onChange={(e) => setParam("capacity", Number(e.target.value))} />
                      </div>
                      <div>
                        <Label className="font-semibold">Room Type</Label>
                        <Select value={String(getParamNumber("roomType", 1))} onValueChange={(v) => setParam("roomType", Number(v))}>
                          <SelectTrigger className="mt-1.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Lecture Hall</SelectItem>
                            <SelectItem value="2">Lab</SelectItem>
                            <SelectItem value="3">Studio</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                </div>
              ) : null}

              {conditionType === "adjust_room_capacity" ? (
                  <div className="mb-4">
                    <Label className="font-semibold">New Capacity</Label>
                    <Input className="mt-1.5" type="number" min={1} value={getParamNumber("newCapacity", 30)} onChange={(e) => setParam("newCapacity", Number(e.target.value))} />
                  </div>
              ) : null}

              {conditionType === "change_section_count" || conditionType === "change_delivery_mode" ? (
                  <div className="mb-4 space-y-2">
                    <Label className="font-semibold">Course</Label>
                  <SearchableSelect value={getParamString("courseId")} onChange={(v) => setParam("courseId", v)} placeholder="Select course" options={courseOptions} />
                </div>
              ) : null}

              {conditionType === "change_section_count" ? (
                  <div className="mb-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="font-semibold">New Normal Sections</Label>
                      <Input className="mt-1.5" type="number" min={0} value={getParamNumber("newSectionsNormal", 1)} onChange={(e) => setParam("newSectionsNormal", Number(e.target.value))} />
                    </div>
                    <div>
                      <Label className="font-semibold">New Summer Sections</Label>
                      <Input className="mt-1.5" type="number" min={0} value={getParamNumber("newSectionsSummer", 0)} onChange={(e) => setParam("newSectionsSummer", Number(e.target.value))} />
                    </div>
                </div>
              ) : null}

              {conditionType === "change_delivery_mode" ? (
                  <div className="mb-4">
                    <Label className="font-semibold">New Delivery Mode</Label>
                    <Select value={getParamString("newDeliveryMode") || "FACE_TO_FACE"} onValueChange={(v) => setParam("newDeliveryMode", v)}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DELIVERY_MODES.map((mode) => (
                          <SelectItem key={mode} value={mode}>
                            {deliveryModeLabel(mode)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
              ) : null}

              {conditionType === "add_course" ? (
                  <div className="mb-4 grid gap-4 md:grid-cols-2">
                  <div>
                      <Label className="font-semibold">Course Code</Label>
                      <Input className="mt-1.5" maxLength={20} value={getParamString("courseCode")} onChange={(e) => setParam("courseCode", e.target.value)} />
                    </div>
                    <div>
                      <Label className="font-semibold">Course Name</Label>
                      <Input className="mt-1.5" value={getParamString("courseName")} onChange={(e) => setParam("courseName", e.target.value)} />
                    </div>
                    <div>
                      <Label className="font-semibold">Department</Label>
                    <Select value={getParamString("deptId") || "1"} onValueChange={(v) => setParam("deptId", v)}>
                        <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d, i) => (
                          <SelectItem key={d} value={String(i + 1)}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                    <div>
                      <Label className="font-semibold">Academic Level (Auto)</Label>
                      <Input
                        className="mt-1.5"
                        value={String(academicLevelFromCourseCode(getParamString("courseCode")))}
                        readOnly
                      />
                    </div>
                    <div>
                      <Label className="font-semibold">Credit Hours</Label>
                      <Input className="mt-1.5" type="number" min={1} value={getParamNumber("creditHours", 3)} onChange={(e) => setParam("creditHours", Number(e.target.value))} />
                    </div>
                    <div>
                      <Label className="font-semibold">Delivery Mode</Label>
                      <Select value={getParamString("newDeliveryMode") || "FACE_TO_FACE"} onValueChange={(v) => setParam("newDeliveryMode", v)}>
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DELIVERY_MODES.map((mode) => (
                            <SelectItem key={mode} value={mode}>
                              {deliveryModeLabel(mode)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="font-semibold">Sections (Normal)</Label>
                      <Input className="mt-1.5" type="number" min={0} value={getParamNumber("sectionsNormal", 1)} onChange={(e) => setParam("sectionsNormal", Number(e.target.value))} />
                    </div>
                    <div>
                      <Label className="font-semibold">Sections (Summer)</Label>
                      <Input className="mt-1.5" type="number" min={0} value={getParamNumber("sectionsSummer", 0)} onChange={(e) => setParam("sectionsSummer", Number(e.target.value))} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border px-3 py-2 md:col-span-2">
                      <Label className="font-medium">Is Lab</Label>
                      <Switch checked={Boolean(draftParams.isLab)} onCheckedChange={(v) => setParam("isLab", v)} />
                    </div>
                    <div className="md:col-span-2">
                      <MultiSelectChecklist
                        title="Assignable Lecturers"
                        options={lecturerOptions}
                        values={getParamStringArray("assignableLecturerIds")}
                        onChange={(next) => setParam("assignableLecturerIds", next)}
                        placeholder="Search lecturers by name..."
                      />
                    </div>
                </div>
              ) : null}

              {conditionType === "add_timeslot" ? (
                  <div className="mb-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="font-semibold">Start Time</Label>
                      <Input className="mt-1.5" type="time" value={getParamString("startTime")} onChange={(e) => setParam("startTime", e.target.value)} />
                    </div>
                    <div>
                      <Label className="font-semibold">End Time</Label>
                      <Input className="mt-1.5" type="time" value={getParamString("endTime")} onChange={(e) => setParam("endTime", e.target.value)} />
                    </div>
                    <div>
                      <Label className="font-semibold">Slot Type</Label>
                      <Select value={getParamString("slotType") || "Traditional Lecture"} onValueChange={(v) => setParam("slotType", v)}>
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {slotTypes.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border px-3 py-2 md:col-span-2">
                      <Label className="font-medium">Is Summer</Label>
                      <Switch checked={Boolean(draftParams.isSummer)} onCheckedChange={(v) => setParam("isSummer", v)} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="font-semibold">Days</Label>
                      <div className="grid grid-cols-2 gap-2 rounded-lg border p-3 sm:grid-cols-3">
                        {TIMESLOT_DAYS.map((day) => {
                          const selected = getParamStringArray("days").includes(day);
                          return (
                            <label key={day} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={selected}
                                onCheckedChange={(checked) => {
                                  const prev = getParamStringArray("days");
                                  const next = checked ? [...prev, day] : prev.filter((d) => d !== day);
                                  setParam("days", next);
                                }}
                              />
                              <span>{day}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                </div>
              ) : null}

              {conditionType === "delete_timeslot" ? (
                  <div className="mb-4 space-y-2">
                    <Label className="font-semibold">Timeslot</Label>
                  <SearchableSelect
                    value={getParamString("slotId")}
                    onChange={(v) => setParam("slotId", v)}
                    placeholder="Select timeslot"
                    options={selectableDeleteTimeslotOptions}
                  />
                </div>
              ) : null}

                <div className="border-t pt-4">
                  <Button type="button" className="w-full" size="lg" onClick={() => commitConditionForm()}>
                    Save Condition
              </Button>
            </div>
                    </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
      <Dialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
        <DialogContent className="z-[220] border-2 border-border/90 bg-popover shadow-2xl ring-1 ring-black/10 sm:max-w-lg">
          <DialogHeader className="gap-3 text-left">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="h-4.5 w-4.5" />
              </div>
              <div className="space-y-1.5">
                <DialogTitle className="text-xl font-semibold">Discard unsaved changes?</DialogTitle>
                <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                  Your edits to this scenario will be permanently lost. This cannot be undone.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="mt-2 gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setDiscardConfirmOpen(false)}>
              Keep editing
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDiscardConfirmOpen(false);
                setDrawerOpen(false);
              }}
            >
              Discard changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete scenario?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleteTarget?.hasAppliedRuns
              ? "This scenario has been applied to a timetable. Deleting it will not undo the applied changes."
              : "This action cannot be undone."}
          </p>
          {deleteTarget?.hasAppliedRuns ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={forceDelete} onCheckedChange={(v) => setForceDelete(Boolean(v))} />
              Force delete
            </label>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={Boolean(deleteTarget?.hasAppliedRuns) && !forceDelete}
              onClick={async () => {
                if (!deleteTarget) return;
                await ApiClient.request(`/what-if/scenarios/${deleteTarget.id}?force=${forceDelete ? "true" : "false"}`, { method: "DELETE" });
                toast({ title: "Scenario deleted" });
                setDeleteTarget(null);
                await load();
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
