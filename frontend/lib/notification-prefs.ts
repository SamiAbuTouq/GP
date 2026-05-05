/** Keep keys in sync with `backend/src/notifications/notification-prefs.ts`. */

export const ADMIN_NOTIFICATION_PREF_KEYS = {
  OPTIMIZATION_COMPLETED: "admin_optimization_completed",
  GWO_BROWSER_COMPLETED: "admin_gwo_browser_completed",
  HARD_CONFLICTS: "admin_hard_conflicts",
  OPTIMIZATION_FAILED: "admin_optimization_failed",
  LECTURER_PREFERENCES: "admin_lecturer_preferences",
  ACCESS_REQUESTS: "admin_access_requests",
  LECTURER_DEACTIVATION_IMPACT: "admin_lecturer_deactivation_impact",
} as const;

export const LECTURER_NOTIFICATION_PREF_KEYS = {
  SCHEDULE_PUBLISHED: "lec_schedule_published",
  SCHEDULE_REVISED: "lec_schedule_revised",
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
    [ADMIN_NOTIFICATION_PREF_KEYS.GWO_BROWSER_COMPLETED]: true,
    [ADMIN_NOTIFICATION_PREF_KEYS.HARD_CONFLICTS]: true,
    [ADMIN_NOTIFICATION_PREF_KEYS.OPTIMIZATION_FAILED]: true,
    [ADMIN_NOTIFICATION_PREF_KEYS.LECTURER_PREFERENCES]: true,
    [ADMIN_NOTIFICATION_PREF_KEYS.ACCESS_REQUESTS]: true,
    [ADMIN_NOTIFICATION_PREF_KEYS.LECTURER_DEACTIVATION_IMPACT]: true,
    [LECTURER_NOTIFICATION_PREF_KEYS.SCHEDULE_PUBLISHED]: true,
    [LECTURER_NOTIFICATION_PREF_KEYS.SCHEDULE_REVISED]: true,
    [LECTURER_NOTIFICATION_PREF_KEYS.PROFILE_UPDATED_BY_ADMIN]: true,
  };
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "boolean" && Object.prototype.hasOwnProperty.call(base, k)) {
        base[k] = v;
      }
    }
  }
  return base;
}
