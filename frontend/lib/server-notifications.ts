import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import {
  ADMIN_NOTIFICATION_PREF_KEYS,
  notificationPrefsAllow,
} from "@/lib/notification-prefs";

/** Keep in sync with backend `NotificationsService` title cap. */
export const NOTIFICATION_TITLE_MAX = 100;
export const NOTIFICATION_MESSAGE_MAX = 2000;

const recentOptimizerFailureAt = new Map<string, number>();
const OPTIMIZER_FAIL_DEDUPE_MS = 45_000;

function pruneFailureDedupeMap(now: number): void {
  for (const [k, t] of recentOptimizerFailureAt) {
    if (now - t > OPTIMIZER_FAIL_DEDUPE_MS) recentOptimizerFailureAt.delete(k);
  }
}

export async function getAdminRecipientsForPreference(
  prefKey: string,
  exceptUserId?: number,
): Promise<number[]> {
  const rows = await prisma.user.findMany({
    where: {
      role_name: Role.ADMIN,
      is_active: true,
      ...(exceptUserId != null && Number.isFinite(exceptUserId)
        ? { user_id: { not: exceptUserId } }
        : {}),
    },
    select: { user_id: true, notification_prefs: true },
  });
  return rows
    .filter((r) => notificationPrefsAllow(r.notification_prefs, prefKey))
    .map((r) => r.user_id);
}

export async function insertNotifications(
  userIds: number[],
  messageTitle: string,
  message: string,
): Promise<void> {
  const unique = [...new Set(userIds.filter((id) => id > 0))];
  if (unique.length === 0) return;
  const title = messageTitle.slice(0, NOTIFICATION_TITLE_MAX);
  const body = message.slice(0, NOTIFICATION_MESSAGE_MAX);
  await prisma.notification.createMany({
    data: unique.map((user_id) => ({
      user_id,
      message_title: title,
      message: body,
      is_read: false,
    })),
  });
}

export async function notifyAdminsTimetablePersisted(params: {
  timetableName: string;
  timetableId: number;
  versionNumber: number;
  hardConflictCount: number;
  bestFitness?: number | null;
}) {
  const fit =
    params.bestFitness != null && Number.isFinite(Number(params.bestFitness))
      ? Number(params.bestFitness).toFixed(4)
      : "n/a";
  const msg = `${params.timetableName} (timetable #${params.timetableId}, v${params.versionNumber}) stored. Fitness score ${fit}. Hard conflicts in validation: ${params.hardConflictCount}. [[timetable_id:${params.timetableId}]]`;

  const optIds = await getAdminRecipientsForPreference(
    ADMIN_NOTIFICATION_PREF_KEYS.OPTIMIZATION_COMPLETED,
  );
  await insertNotifications(optIds, "Timetable Generated", msg);

  if (params.hardConflictCount > 0) {
    const conflictIds = await getAdminRecipientsForPreference(
      ADMIN_NOTIFICATION_PREF_KEYS.HARD_CONFLICTS,
    );
    await insertNotifications(
      conflictIds,
      "Hard Conflicts Detected",
      `${params.hardConflictCount} hard conflict(s) in generated timetable #${params.timetableId} (${params.timetableName}). [[timetable_id:${params.timetableId}]]`,
    );
  }
}

/** Successful GWO run on the Timetable generation page (`POST /api/run`). */
export async function notifyAdminsGwoBrowserRunFinished(params: {
  semesterMode: "normal" | "summer";
}): Promise<void> {
  const modeLabel = params.semesterMode === "summer" ? "Summer" : "Regular";
  const msg = `Grey Wolf optimizer finished on the Timetable generation page (${modeLabel} semester mode). Review the schedule on that page, then save to the database when ready.`;
  const ids = await getAdminRecipientsForPreference(
    ADMIN_NOTIFICATION_PREF_KEYS.GWO_BROWSER_COMPLETED,
  );
  await insertNotifications(ids, "Browser timetable run finished", msg);
}

export async function notifyAdminsOptimizerFailed(errorSummary: string): Promise<void> {
  const now = Date.now();
  pruneFailureDedupeMap(now);
  const key = errorSummary.slice(0, 500);
  const last = recentOptimizerFailureAt.get(key);
  if (last != null && now - last < OPTIMIZER_FAIL_DEDUPE_MS) {
    return;
  }
  recentOptimizerFailureAt.set(key, now);

  const ids = await getAdminRecipientsForPreference(
    ADMIN_NOTIFICATION_PREF_KEYS.OPTIMIZATION_FAILED,
  );
  const msg = errorSummary.slice(0, NOTIFICATION_MESSAGE_MAX);
  await insertNotifications(ids, "Optimization Failed", msg);
}
