import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import {
  ADMIN_NOTIFICATION_PREF_KEYS,
  notificationPrefsAllow,
} from "@/lib/notification-prefs";

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
  const title = messageTitle.slice(0, 100);
  await prisma.notification.createMany({
    data: unique.map((user_id) => ({
      user_id,
      message_title: title,
      message,
      is_read: false,
    })),
  });
}

export async function notifyAdminsTimetablePersisted(params: {
  exceptUserId?: number;
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
  const msg = `${params.timetableName} (timetable #${params.timetableId}, v${params.versionNumber}) stored. Fitness score ${fit}. Hard conflicts in validation: ${params.hardConflictCount}.`;

  const optIds = await getAdminRecipientsForPreference(
    ADMIN_NOTIFICATION_PREF_KEYS.OPTIMIZATION_COMPLETED,
    params.exceptUserId,
  );
  await insertNotifications(optIds, "Timetable Generated", msg);

  if (params.hardConflictCount > 0) {
    const conflictIds = await getAdminRecipientsForPreference(
      ADMIN_NOTIFICATION_PREF_KEYS.HARD_CONFLICTS,
      params.exceptUserId,
    );
    await insertNotifications(
      conflictIds,
      "Hard Conflicts Detected",
      `${params.hardConflictCount} hard conflict(s) in generated timetable #${params.timetableId} (${params.timetableName}).`,
    );
  }
}

export async function notifyAdminsOptimizerFailed(errorSummary: string): Promise<void> {
  const rows = await prisma.user.findMany({
    where: { role_name: Role.ADMIN, is_active: true },
    select: { user_id: true },
  });
  const ids = rows.map((r) => r.user_id);
  const msg = errorSummary.slice(0, 2000);
  await insertNotifications(ids, "Optimization Failed", msg);
}
