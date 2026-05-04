"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { ApiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import {
  DEFAULT_DATETIME_PREFS,
  type DateTimeFormatPreferences,
  formatClockFromDate,
  formatDateOnly,
  formatDateTime,
  formatDateTimeCompact,
  formatHourFloatAsClock,
  formatSessionTimeRangeLabel,
  formatTimeslotClockRange,
  formatWallClockFromHhMm,
  normalizeDateFormat,
  normalizeTimeFormat,
  prefsFromProfile,
  safeParseDate,
} from "@/lib/datetime-format"

export type DateTimeFormatApi = {
  prefs: DateTimeFormatPreferences
  formatDate: (input: Date | string | number) => string
  formatTime: (input: Date | string | number, options?: { includeSeconds?: boolean }) => string
  formatDateTime: (input: Date | string | number) => string
  formatDateTimeCompact: (input: Date | string | number) => string
  formatHourFloatAsClock: (hourFloat: number) => string
  formatTimeslotClockRange: (startHour: number, durationHours: number) => string
  formatWallClockFromHhMm: (hhmm: string) => string
  formatSessionTimeRange: (range: string) => string
}

const DateTimeFormatContext = createContext<DateTimeFormatApi | null>(null)

export function DateTimePreferencesProvider({ children }: { children: ReactNode }) {
  const { user, authLoading } = useAuth()
  const [prefs, setPrefs] = useState<DateTimeFormatPreferences>(() =>
    prefsFromProfile(ApiClient.getCachedProfile()),
  )

  useEffect(() => {
    return ApiClient.onProfileUpdate((partial) => {
      setPrefs((prev) => ({
        dateFormat:
          partial.date_format != null ? normalizeDateFormat(partial.date_format) : prev.dateFormat,
        timeFormat:
          partial.time_format != null ? normalizeTimeFormat(partial.time_format) : prev.timeFormat,
      }))
    })
  }, [])

  useEffect(() => {
    if (!user || authLoading) return
    ApiClient.getProfile()
      .then((p) => setPrefs(prefsFromProfile(p)))
      .catch(() => {})
  }, [user, authLoading])

  useEffect(() => {
    if (!user) setPrefs(DEFAULT_DATETIME_PREFS)
  }, [user])

  const api = useMemo((): DateTimeFormatApi => {
    const p = prefs
    return {
      prefs: p,
      formatDate: (input) => {
        const d = safeParseDate(input)
        return d ? formatDateOnly(d, p.dateFormat) : "—"
      },
      formatTime: (input, options) => {
        const d = safeParseDate(input)
        return d ? formatClockFromDate(d, p.timeFormat, options) : "—"
      },
      formatDateTime: (input) => formatDateTime(input, p),
      formatDateTimeCompact: (input) => formatDateTimeCompact(input, p),
      formatHourFloatAsClock: (hourFloat) => formatHourFloatAsClock(hourFloat, p.timeFormat),
      formatTimeslotClockRange: (startHour, durationHours) =>
        formatTimeslotClockRange(startHour, durationHours, p.timeFormat),
      formatWallClockFromHhMm: (hhmm) => formatWallClockFromHhMm(hhmm, p.timeFormat),
      formatSessionTimeRange: (range) => formatSessionTimeRangeLabel(range, p.timeFormat),
    }
  }, [prefs])

  return <DateTimeFormatContext.Provider value={api}>{children}</DateTimeFormatContext.Provider>
}

export function useDateTimeFormat(): DateTimeFormatApi {
  const ctx = useContext(DateTimeFormatContext)
  if (!ctx) {
    throw new Error("useDateTimeFormat must be used within DateTimePreferencesProvider")
  }
  return ctx
}

function buildDefaultApi(): DateTimeFormatApi {
  const p = DEFAULT_DATETIME_PREFS
  return {
    prefs: p,
    formatDate: (input) => {
      const d = safeParseDate(input)
      return d ? formatDateOnly(d, p.dateFormat) : "—"
    },
    formatTime: (input, options) => {
      const d = safeParseDate(input)
      return d ? formatClockFromDate(d, p.timeFormat, options) : "—"
    },
    formatDateTime: (input) => formatDateTime(input, p),
    formatDateTimeCompact: (input) => formatDateTimeCompact(input, p),
    formatHourFloatAsClock: (hourFloat) => formatHourFloatAsClock(hourFloat, p.timeFormat),
    formatTimeslotClockRange: (startHour, durationHours) =>
      formatTimeslotClockRange(startHour, durationHours, p.timeFormat),
    formatWallClockFromHhMm: (hhmm) => formatWallClockFromHhMm(hhmm, p.timeFormat),
    formatSessionTimeRange: (range) => formatSessionTimeRangeLabel(range, p.timeFormat),
  }
}

const defaultApiSingleton = buildDefaultApi()

/** Uses live preferences when inside the provider; otherwise default DMY + 24h. */
export function useDateTimeFormatOptional(): DateTimeFormatApi {
  const ctx = useContext(DateTimeFormatContext)
  return ctx ?? defaultApiSingleton
}
