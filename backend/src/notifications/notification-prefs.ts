/** Stored under `User.notification_prefs` as `{ [key]: boolean }`; omitted keys default to enabled (true). */

export const ADMIN_NOTIFICATION_PREF_KEYS = {
  /** Persisted timetable / What-If simulation completed successfully. */
  OPTIMIZATION_COMPLETED: 'admin_optimization_completed',
  /** Timetable generation page (`/api/run` / GWO in browser) finished successfully. */
  GWO_BROWSER_COMPLETED: 'admin_gwo_browser_completed',
  HARD_CONFLICTS: 'admin_hard_conflicts',
  OPTIMIZATION_FAILED: 'admin_optimization_failed',
  LECTURER_PREFERENCES: 'admin_lecturer_preferences',
  TIMETABLE_PUBLISHED_BY_OTHER: 'admin_timetable_published_by_other',
  ACCESS_REQUESTS: 'admin_access_requests',
  LECTURER_DEACTIVATION_IMPACT: 'admin_lecturer_deactivation_impact',
} as const;

export const LECTURER_NOTIFICATION_PREF_KEYS = {
  SCHEDULE_PUBLISHED: 'lec_schedule_published',
  SCHEDULE_REVISED: 'lec_schedule_revised',
  PREFERENCE_NOT_HONORED: 'lec_preference_not_honored',
  PROFILE_UPDATED_BY_ADMIN: 'lec_profile_updated_by_admin',
} as const;

export function notificationPrefsAllow(raw: unknown, key: string): boolean {
  if (raw == null) return true;
  if (typeof raw !== 'object' || Array.isArray(raw)) return true;
  const v = (raw as Record<string, unknown>)[key];
  if (v === false) return false;
  return true;
}

export function mergeNotificationPrefs(raw: unknown): Record<string, boolean> {
  const base: Record<string, boolean> = {
    [ADMIN_NOTIFICATION_PREF_KEYS.OPTIMIZATION_COMPLETED]: true,
    [ADMIN_NOTIFICATION_PREF_KEYS.GWO_BROWSER_COMPLETED]: true,
    [ADMIN_NOTIFICATION_PREF_KEYS.HARD_CONFLICTS]: true,
    [ADMIN_NOTIFICATION_PREF_KEYS.OPTIMIZATION_FAILED]: true,
    [ADMIN_NOTIFICATION_PREF_KEYS.LECTURER_PREFERENCES]: true,
    [ADMIN_NOTIFICATION_PREF_KEYS.TIMETABLE_PUBLISHED_BY_OTHER]: true,
    [ADMIN_NOTIFICATION_PREF_KEYS.ACCESS_REQUESTS]: true,
    [ADMIN_NOTIFICATION_PREF_KEYS.LECTURER_DEACTIVATION_IMPACT]: true,
    [LECTURER_NOTIFICATION_PREF_KEYS.SCHEDULE_PUBLISHED]: true,
    [LECTURER_NOTIFICATION_PREF_KEYS.SCHEDULE_REVISED]: true,
    [LECTURER_NOTIFICATION_PREF_KEYS.PREFERENCE_NOT_HONORED]: true,
    [LECTURER_NOTIFICATION_PREF_KEYS.PROFILE_UPDATED_BY_ADMIN]: true,
  };
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'boolean') base[k] = v;
    }
  }
  return base;
}

/** Allowed JSON keys per role for PATCH validation. */
export const ALLOWED_NOTIFICATION_PREF_KEYS_BY_ROLE: Record<string, Set<string>> = {
  ADMIN: new Set(Object.values(ADMIN_NOTIFICATION_PREF_KEYS)),
  LECTURER: new Set(Object.values(LECTURER_NOTIFICATION_PREF_KEYS)),
};
