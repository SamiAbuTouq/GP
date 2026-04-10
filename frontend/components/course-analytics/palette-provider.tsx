'use client'

import React, { createContext, useContext, useEffect, useState, type RefObject } from 'react'
import { useCourseAnalyticsTheme } from '@/lib/course-analytics/analytics-theme-context'
import { palettes, DEFAULT_PALETTE_ID, type Palette } from '@/lib/course-analytics/palettes'

type PaletteContextValue = {
  activePaletteId: string
  activePalette: Palette
  setPaletteId: (id: string) => void
  palettes: Palette[]
}

const PaletteContext = createContext<PaletteContextValue | null>(null)

const STORAGE_KEY = 'psut-course-analytics-palette'

export function PaletteProvider({
  children,
  containerRef,
}: {
  children: React.ReactNode
  containerRef: RefObject<HTMLElement | null>
}) {
  const { resolvedTheme } = useCourseAnalyticsTheme()
  const [activePaletteId, setActivePaletteId] = useState<string>(DEFAULT_PALETTE_ID)
  const [mounted, setMounted] = useState(false)

  // Read persisted palette on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && palettes.find((p) => p.id === stored)) {
      setActivePaletteId(stored)
    }
    setMounted(true)
  }, [])

  // Apply CSS vars whenever palette or theme changes (scoped to analytics container only)
  useEffect(() => {
    if (!mounted) return
    const el = containerRef.current
    if (!el) return
    const palette = palettes.find((p) => p.id === activePaletteId) ?? palettes[0]
    const isDark = resolvedTheme === 'dark'
    const vars = isDark ? palette.dark : palette.light
    Object.entries(vars).forEach(([key, value]) => {
      el.style.setProperty(key, value)
    })
  }, [activePaletteId, resolvedTheme, mounted, containerRef])

  const setPaletteId = (id: string) => {
    setActivePaletteId(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  const activePalette = palettes.find((p) => p.id === activePaletteId) ?? palettes[0]

  return (
    <PaletteContext.Provider value={{ activePaletteId, activePalette, setPaletteId, palettes }}>
      {children}
    </PaletteContext.Provider>
  )
}

export function usePalette() {
  const ctx = useContext(PaletteContext)
  if (!ctx) throw new Error('usePalette must be used inside PaletteProvider')
  return ctx
}
