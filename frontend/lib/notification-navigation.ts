const LECTURER_USER_ID_TAG = /\[\[lecturer_user_id:(\d+)\]\]\s*$/;
const TIMETABLE_ID_TAG = /\[\[timetable_id:(\d+)\]\]\s*$/;
const SCENARIO_RUN_ID_TAG = /\[\[scenario_run_id:(\d+)\]\]\s*$/;

export function parseLecturerUserIdFromMessage(message: string): number | undefined {
  const m = message.match(LECTURER_USER_ID_TAG);
  if (!m) return undefined;
  const id = Number(m[1]);
  return Number.isFinite(id) && id > 0 ? id : undefined;
}

export function parseTimetableIdFromMessage(message: string): number | undefined {
  const m = message.match(TIMETABLE_ID_TAG);
  if (!m) return undefined;
  const id = Number(m[1]);
  return Number.isFinite(id) && id > 0 ? id : undefined;
}

export function stripNotificationMachineTags(message: string): string {
  return message
    .replace(LECTURER_USER_ID_TAG, "")
    .replace(TIMETABLE_ID_TAG, "")
    .replace(SCENARIO_RUN_ID_TAG, "")
    .trimEnd();
}

/**
 * Map persisted notification titles to in-app routes. DB schema has no link field.
 */
export function getNotificationHref(
  messageTitle: string,
  opts?: { role?: string; message?: string },
): string | null {
  const t = messageTitle.trim();
  const role = opts?.role ?? "";
  const lecturerUserId = opts?.message ? parseLecturerUserIdFromMessage(opts.message) : undefined;

  if (t === "Timetable Published" || t === "Hard Conflicts Detected" || t === "Timetable Generated") {
    const tid = opts?.message ? parseTimetableIdFromMessage(opts.message) : undefined;
    if (tid != null) return `/schedule?timetableId=${tid}`;
    if (t === "Timetable Generated" && opts?.message?.includes("[[scenario_run_id:")) {
      return "/dashboard/what-if";
    }
    return "/schedule";
  }
  if (t === "Optimization Failed" || t === "Browser timetable run finished") {
    return "/timetable-generation";
  }
  if (t === "Preferences Submitted" || t === "Preferences Updated") {
    if (role === "ADMIN" && lecturerUserId != null) {
      return `/entity/lecturers/${lecturerUserId}`;
    }
    return "/entity/lecturers";
  }
  if (t === "Lecturer Deactivated — Schedule Impact") {
    return "/entity/lecturers";
  }
  if (t === "New Lecturer Access Request") {
    return "/entity/access-requests";
  }
  if (t === "Your Schedule is Ready" || t === "Schedule Updated") {
    return "/lecturer-schedule";
  }
  if (t === "Preference Not Honored") {
    return "/lecturer-time-preferences";
  }
  if (t === "Your Profile Was Updated") {
    return "/settings";
  }
  return null;
}
