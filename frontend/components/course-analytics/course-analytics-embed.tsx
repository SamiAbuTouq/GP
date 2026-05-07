'use client'

import { useRef } from 'react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { PaletteProvider } from '@/components/course-analytics/palette-provider'
import CourseAnalyticsApp from '@/components/course-analytics/course-analytics-app'

function CourseAnalyticsThemedSurface({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme()
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
    <CourseAnalyticsThemedSurface>
      <CourseAnalyticsApp onInitialLoadComplete={onInitialLoadComplete} />
    </CourseAnalyticsThemedSurface>
  )
}
