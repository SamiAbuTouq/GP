import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminFromRefreshCookie } from "@/lib/server-auth";
import { prismaTimeslotRowToConfig, mergeFileConfigWithDatabase } from "@/lib/db-schedule-config";
import { mergeConfigWithDefaults } from "@/lib/schedule-config-merge";
import { readFile } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import type { ScheduleConfig, ScheduleEntry } from "@/lib/schedule-data";
import { findLectureConfig, entryNeedsRoom } from "@/lib/schedule-edit-rules";
import type { TimeslotCatalogueEntry } from "@/lib/timetable-model";

const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");

async function loadMergedConfig(): Promise<ScheduleConfig> {
  if (existsSync(CONFIG_FILE)) {
    const raw = JSON.parse(await readFile(CONFIG_FILE, "utf-8")) as Record<string, unknown>;
    return mergeFileConfigWithDatabase(mergeConfigWithDefaults(raw));
  }
  return mergeFileConfigWithDatabase(mergeConfigWithDefaults({} as Record<string, unknown>));
}

function approxEq(a: number, b: number, eps = 0.12): boolean {
  return Math.abs(a - b) <= eps;
}

function daysShallowEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  const aa = [...(a ?? [])].sort().join("|");
  const bb = [...(b ?? [])].sort().join("|");
  return aa === bb;
}

async function resolveTimeslotToSlotId(
  timeslotId: string,
  catalogue: TimeslotCatalogueEntry[],
): Promise<number | null> {
  const trimmed = timeslotId.trim();
  const direct = /^slot_(\d+)$/i.exec(trimmed);
  if (direct) {
    const n = Number(direct[1]);
    if (Number.isFinite(n)) {
      const exists = await prisma.timeslot.findUnique({ where: { slot_id: n }, select: { slot_id: true } });
      if (exists) return n;
    }
  }

  const rows = await prisma.timeslot.findMany({ orderBy: { slot_id: "asc" } });
  const idToSlot = new Map<string, number>();
  for (const r of rows) {
    const c = prismaTimeslotRowToConfig(r);
    if (c?.id) idToSlot.set(c.id, r.slot_id);
  }
  if (idToSlot.has(trimmed)) return idToSlot.get(trimmed)!;

  const cat = catalogue.find((t) => t.id === trimmed);
  if (!cat) return null;

  for (const r of rows) {
    const c = prismaTimeslotRowToConfig(r);
    if (!c) continue;
    if (c.slot_type === cat.slot_type && daysShallowEqual(c.days, cat.days) && approxEq(c.start_hour ?? 0, cat.start_hour ?? 0)) {
      return r.slot_id;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminFromRefreshCookie();
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json()) as {
      semesterId?: number | null;
      /** When saving an unassigned GWO draft, set to the last stored timetable id to bump version; omit after a new optimizer run so the next store is v1 again. */
      continueFromTimetableId?: number | null;
      schedule?: ScheduleEntry[];
      timeslots_catalogue?: TimeslotCatalogueEntry[];
    };

    const parsedSemesterId = Number(body.semesterId);
    const semesterId =
      Number.isFinite(parsedSemesterId) && parsedSemesterId > 0 ? parsedSemesterId : null;
    if (!Array.isArray(body.schedule) || body.schedule.length === 0) {
      return NextResponse.json({ error: "schedule must be a non-empty array." }, { status: 400 });
    }

    if (semesterId != null) {
      const semester = await prisma.semester.findUnique({
        where: { semester_id: semesterId },
        select: { semester_id: true },
      });
      if (!semester) {
        return NextResponse.json({ error: `Semester ${semesterId} not found.` }, { status: 404 });
      }
    }

    const config = await loadMergedConfig();
    const catalogue = body.timeslots_catalogue ?? [];

    const virtualRoom =
      (await prisma.room.findFirst({ where: { room_type: 3 }, select: { room_id: true } })) ??
      (await prisma.room.findFirst({ orderBy: { room_id: "asc" }, select: { room_id: true } }));

    if (!virtualRoom) {
      return NextResponse.json({ error: "No room rows in database — cannot persist timetable." }, { status: 500 });
    }

    const lecturers = await prisma.lecturer.findMany({
      include: { user: { select: { first_name: true, last_name: true } } },
    });
    const lecturerByName = new Map<string, number>();
    for (const l of lecturers) {
      const fn = l.user.first_name?.trim() ?? "";
      const ln = l.user.last_name?.trim() ?? "";
      const full = `${fn} ${ln}`.trim().toLowerCase();
      if (full) lecturerByName.set(full, l.user_id);
    }

    const rooms = await prisma.room.findMany({ select: { room_id: true, room_number: true } });
    const roomByNumber = new Map<string, number>();
    for (const r of rooms) {
      roomByNumber.set(r.room_number.trim().toLowerCase(), r.room_id);
    }

    let nextVersion: number;
    if (semesterId == null) {
      const raw = body.continueFromTimetableId;
      const continueId =
        typeof raw === "number" && Number.isFinite(raw) && raw > 0
          ? Math.trunc(raw)
          : typeof raw === "string" && raw.trim() !== ""
            ? Number(raw.trim())
            : NaN;
      if (Number.isFinite(continueId) && continueId > 0) {
        const parent = await prisma.timetable.findUnique({
          where: { timetable_id: continueId },
          select: { version_number: true, semester_id: true },
        });
        if (parent != null && parent.semester_id == null) {
          nextVersion = parent.version_number + 1;
        } else {
          nextVersion = 1;
        }
      } else {
        nextVersion = 1;
      }
    } else {
      const maxVersion = await prisma.timetable.aggregate({
        where: { semester_id: semesterId },
        _max: { version_number: true },
      });
      nextVersion = (maxVersion._max.version_number ?? 0) + 1;
    }

    const rowsToCreate: {
      user_id: number;
      slot_id: number;
      course_id: number;
      room_id: number;
      registered_students: number;
      section_number: string;
    }[] = [];

    for (const e of body.schedule) {
      const lec = findLectureConfig(config, e);
      if (!lec) {
        return NextResponse.json(
          { error: `No config lecture for ${e.course_code} (lecture_id=${e.lecture_id}).` },
          { status: 400 },
        );
      }

      const course = await prisma.course.findFirst({
        where: { course_code: lec.course.trim() },
        select: { course_id: true },
      });
      if (!course) {
        return NextResponse.json({ error: `Unknown course code "${lec.course}".` }, { status: 400 });
      }

      const slotId = await resolveTimeslotToSlotId(e.timeslot, catalogue);
      if (slotId == null) {
        return NextResponse.json(
          { error: `Could not map timeslot "${e.timeslot}" to a database slot. Use DB-backed timeslot ids (e.g. slot_12).` },
          { status: 400 },
        );
      }

      const lecturerKey = e.lecturer.trim().toLowerCase();
      const userId = lecturerByName.get(lecturerKey);
      if (userId == null) {
        return NextResponse.json({ error: `Unknown lecturer "${e.lecturer}".` }, { status: 400 });
      }

      let roomId = virtualRoom.room_id;
      if (entryNeedsRoom(e)) {
        const rn = (e.room || "").trim();
        const rid = roomByNumber.get(rn.toLowerCase());
        if (rid == null) {
          return NextResponse.json({ error: `Unknown room "${e.room}".` }, { status: 400 });
        }
        roomId = rid;
      }

      const section = (lec.section_number && String(lec.section_number).trim()) || "S1";
      const reg = Math.max(0, Math.round(e.class_size ?? lec.size ?? 0));

      rowsToCreate.push({
        user_id: userId,
        slot_id: slotId,
        course_id: course.course_id,
        room_id: roomId,
        registered_students: reg,
        section_number: section,
      });
    }

    const timetable = await prisma.$transaction(async (tx) => {
      const t = await tx.timetable.create({
        data: {
          semester_id: semesterId,
          status: "draft",
          generation_type: "gwo_ui",
          version_number: nextVersion,
        },
      });

      for (const row of rowsToCreate) {
        await tx.sectionScheduleEntry.create({
          data: {
            timetable_id: t.timetable_id,
            ...row,
          },
        });
      }

      return t;
    });

    const semesterTypeLabel = (type: number): string => {
      const map: Record<number, string> = {
        1: "First Semester",
        2: "Second Semester",
        3: "Summer Semester",
      };
      return map[type] ?? `Semester ${type}`;
    };

    let timetableName = `Timetable #${timetable.timetable_id}`;
    if (timetable.semester_id != null) {
      const sem = await prisma.semester.findUnique({
        where: { semester_id: timetable.semester_id },
        select: { academic_year: true, semester_type: true },
      });
      if (sem) {
        timetableName = `${sem.academic_year} · ${semesterTypeLabel(sem.semester_type)}`;
      }
    } else {
      timetableName = "Unassigned draft";
    }

    return NextResponse.json({
      ok: true,
      timetableId: timetable.timetable_id,
      versionNumber: nextVersion,
      timetableName,
      status: timetable.status,
      generationType: timetable.generation_type,
      entryCount: rowsToCreate.length,
    });
  } catch (err) {
    console.error("[POST /api/timetables/persist]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
