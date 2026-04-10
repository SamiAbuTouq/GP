'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'
import {
  CourseAnalyticsThemeProvider,
  useCourseAnalyticsTheme,
} from '@/lib/course-analytics/analytics-theme-context'
import { PaletteProvider } from '@/components/course-analytics/palette-provider'
import CourseAnalyticsApp from '@/components/course-analytics/course-analytics-app'

function CourseAnalyticsThemedSurface({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useCourseAnalyticsTheme()
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={containerRef}
      className={cn(
        'course-analytics-root h-full w-full overflow-auto',
        resolvedTheme === 'dark' && 'dark',
      )}
    >
      <PaletteProvider containerRef={containerRef}>{children}</PaletteProvider>
    </div>
  )
}

export function CourseAnalyticsEmbed({
  onInitialLoadComplete,
}: {
  onInitialLoadComplete?: () => void
}) {
  return (
    <CourseAnalyticsThemeProvider>
      <CourseAnalyticsThemedSurface>
        <CourseAnalyticsApp onInitialLoadComplete={onInitialLoadComplete} />
      </CourseAnalyticsThemedSurface>
    </CourseAnalyticsThemeProvider>
  )
}
