/** Keep keys in sync with `backend/src/notifications/notification-prefs.ts`. */

export const ADMIN_NOTIFICATION_PREF_KEYS = {
  OPTIMIZATION_COMPLETED: "admin_optimization_completed",
  HARD_CONFLICTS: "admin_hard_conflicts",
  LECTURER_PREFERENCES: "admin_lecturer_preferences",
  TIMETABLE_PUBLISHED_BY_OTHER: "admin_timetable_published_by_other",
} as const;

export const LECTURER_NOTIFICATION_PREF_KEYS = {
  SCHEDULE_PUBLISHED: "lec_schedule_published",
  SCHEDULE_REVISED: "lec_schedule_revised",
  PREFERENCE_NOT_HONORED: "lec_preference_not_honored",
  PROFILE_UPDATED_BY_ADMIN: "lec_profile_updated_by_admin",
} as const;

export type NotificationPrefsState = Record<string, boolean>;

export function notificationPrefsAllow(raw: unknown, key: string): boolean {
  if (raw == null) return true;
  if (typeof raw !== "object" || Array.isArray(raw)) return true;
  const v = (raw as Record<string, unknown>)[key];
  if (v === false) return false;
  return true;
}

export function defaultNotificationPrefsMerged(raw: unknown): NotificationPrefsState {
  const base: NotificationPrefsState = {
    [ADMIN_NOTIFICATION_PREF_KEYS.OPTIMIZATION_COMPLETED]: true,
    [ADMIN_NOTIFICATION_PREF_KEYS.HARD_CONFLICTS]: true,
    [ADMIN_NOTIFICATION_PREF_KEYS.LECTURER_PREFERENCES]: true,
    [ADMIN_NOTIFICATION_PREF_KEYS.TIMETABLE_PUBLISHED_BY_OTHER]: true,
    [LECTURER_NOTIFICATION_PREF_KEYS.SCHEDULE_PUBLISHED]: true,
    [LECTURER_NOTIFICATION_PREF_KEYS.SCHEDULE_REVISED]: true,
    [LECTURER_NOTIFICATION_PREF_KEYS.PREFERENCE_NOT_HONORED]: true,
    [LECTURER_NOTIFICATION_PREF_KEYS.PROFILE_UPDATED_BY_ADMIN]: true,
  };
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "boolean") base[k] = v;
    }
  }
  return base;
}
