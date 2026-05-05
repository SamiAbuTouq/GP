export declare const ADMIN_NOTIFICATION_PREF_KEYS: {
    readonly OPTIMIZATION_COMPLETED: "admin_optimization_completed";
    readonly GWO_BROWSER_COMPLETED: "admin_gwo_browser_completed";
    readonly HARD_CONFLICTS: "admin_hard_conflicts";
    readonly OPTIMIZATION_FAILED: "admin_optimization_failed";
    readonly LECTURER_PREFERENCES: "admin_lecturer_preferences";
    readonly TIMETABLE_PUBLISHED_BY_OTHER: "admin_timetable_published_by_other";
    readonly ACCESS_REQUESTS: "admin_access_requests";
    readonly LECTURER_DEACTIVATION_IMPACT: "admin_lecturer_deactivation_impact";
};
export declare const LECTURER_NOTIFICATION_PREF_KEYS: {
    readonly SCHEDULE_PUBLISHED: "lec_schedule_published";
    readonly SCHEDULE_REVISED: "lec_schedule_revised";
    readonly PREFERENCE_NOT_HONORED: "lec_preference_not_honored";
    readonly PROFILE_UPDATED_BY_ADMIN: "lec_profile_updated_by_admin";
};
export declare function notificationPrefsAllow(raw: unknown, key: string): boolean;
export declare function mergeNotificationPrefs(raw: unknown): Record<string, boolean>;
export declare const ALLOWED_NOTIFICATION_PREF_KEYS_BY_ROLE: Record<string, Set<string>>;
