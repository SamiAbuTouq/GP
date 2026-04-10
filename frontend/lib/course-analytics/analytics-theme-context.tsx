'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'psut-course-analytics-theme'

export type CourseAnalyticsThemeSetting = 'light' | 'dark' | 'system'
export type CourseAnalyticsResolvedTheme = 'light' | 'dark'

type Ctx = {
  theme: CourseAnalyticsThemeSetting
  setTheme: (t: CourseAnalyticsThemeSetting) => void
  resolvedTheme: CourseAnalyticsResolvedTheme
}

const CourseAnalyticsThemeContext = createContext<Ctx | null>(null)

export function CourseAnalyticsThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<CourseAnalyticsThemeSetting>('system')
  const [resolvedTheme, setResolvedTheme] = useState<CourseAnalyticsResolvedTheme>('light')

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY) as CourseAnalyticsThemeSetting | null
      if (s === 'light' || s === 'dark' || s === 'system') setThemeState(s)
    } catch {
      /* ignore */
    }
  }, [])

  const setTheme = useCallback((t: CourseAnalyticsThemeSetting) => {
    setThemeState(t)
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const compute = () => {
      if (theme === 'system') {
        setResolvedTheme(mq.matches ? 'dark' : 'light')
      } else {
        setResolvedTheme(theme)
      }
    }
    compute()
    if (theme !== 'system') return
    mq.addEventListener('change', compute)
    return () => mq.removeEventListener('change', compute)
  }, [theme])

  const value = useMemo(
    () => ({ theme, setTheme, resolvedTheme }),
    [theme, setTheme, resolvedTheme],
  )

  return (
    <CourseAnalyticsThemeContext.Provider value={value}>
      {children}
    </CourseAnalyticsThemeContext.Provider>
  )
}

export function useCourseAnalyticsTheme() {
  const ctx = useContext(CourseAnalyticsThemeContext)
  if (!ctx) {
    throw new Error('useCourseAnalyticsTheme must be used within CourseAnalyticsThemeProvider')
  }
  return ctx
}
