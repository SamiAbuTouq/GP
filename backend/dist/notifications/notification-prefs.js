"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_NOTIFICATION_PREF_KEYS_BY_ROLE = exports.LECTURER_NOTIFICATION_PREF_KEYS = exports.ADMIN_NOTIFICATION_PREF_KEYS = void 0;
exports.notificationPrefsAllow = notificationPrefsAllow;
exports.mergeNotificationPrefs = mergeNotificationPrefs;
exports.ADMIN_NOTIFICATION_PREF_KEYS = {
    OPTIMIZATION_COMPLETED: 'admin_optimization_completed',
    GWO_BROWSER_COMPLETED: 'admin_gwo_browser_completed',
    HARD_CONFLICTS: 'admin_hard_conflicts',
    OPTIMIZATION_FAILED: 'admin_optimization_failed',
    LECTURER_PREFERENCES: 'admin_lecturer_preferences',
    ACCESS_REQUESTS: 'admin_access_requests',
    LECTURER_DEACTIVATION_IMPACT: 'admin_lecturer_deactivation_impact',
};
exports.LECTURER_NOTIFICATION_PREF_KEYS = {
    SCHEDULE_PUBLISHED: 'lec_schedule_published',
    SCHEDULE_REVISED: 'lec_schedule_revised',
    PROFILE_UPDATED_BY_ADMIN: 'lec_profile_updated_by_admin',
};
function notificationPrefsAllow(raw, key) {
    if (raw == null)
        return true;
    if (typeof raw !== 'object' || Array.isArray(raw))
        return true;
    const v = raw[key];
    if (v === false)
        return false;
    return true;
}
function mergeNotificationPrefs(raw) {
    const base = {
        [exports.ADMIN_NOTIFICATION_PREF_KEYS.OPTIMIZATION_COMPLETED]: true,
        [exports.ADMIN_NOTIFICATION_PREF_KEYS.GWO_BROWSER_COMPLETED]: true,
        [exports.ADMIN_NOTIFICATION_PREF_KEYS.HARD_CONFLICTS]: true,
        [exports.ADMIN_NOTIFICATION_PREF_KEYS.OPTIMIZATION_FAILED]: true,
        [exports.ADMIN_NOTIFICATION_PREF_KEYS.LECTURER_PREFERENCES]: true,
        [exports.ADMIN_NOTIFICATION_PREF_KEYS.ACCESS_REQUESTS]: true,
        [exports.ADMIN_NOTIFICATION_PREF_KEYS.LECTURER_DEACTIVATION_IMPACT]: true,
        [exports.LECTURER_NOTIFICATION_PREF_KEYS.SCHEDULE_PUBLISHED]: true,
        [exports.LECTURER_NOTIFICATION_PREF_KEYS.SCHEDULE_REVISED]: true,
        [exports.LECTURER_NOTIFICATION_PREF_KEYS.PROFILE_UPDATED_BY_ADMIN]: true,
    };
    if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
        for (const [k, v] of Object.entries(raw)) {
            if (typeof v === 'boolean' && Object.prototype.hasOwnProperty.call(base, k)) {
                base[k] = v;
            }
        }
    }
    return base;
}
exports.ALLOWED_NOTIFICATION_PREF_KEYS_BY_ROLE = {
    ADMIN: new Set(Object.values(exports.ADMIN_NOTIFICATION_PREF_KEYS)),
    LECTURER: new Set(Object.values(exports.LECTURER_NOTIFICATION_PREF_KEYS)),
};
//# sourceMappingURL=notification-prefs.js.map