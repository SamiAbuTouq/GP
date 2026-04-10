'use client'

import * as React from 'react'
import { Palette } from 'lucide-react'
import { usePalette } from '@/components/course-analytics/palette-provider'
import { Button } from '@/components/course-analytics-ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/course-analytics-ui/dropdown-menu'
import { cn } from '@/lib/utils'

export function PalettePicker() {
  const { activePaletteId, setPaletteId, palettes } = usePalette()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-2 rounded-full px-3" aria-label="Choose color palette">
          <Palette className="h-4 w-4" />
          <span className="hidden sm:inline">Palette</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-2">
        <DropdownMenuLabel className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Color Palette
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="mb-2" />
        <div className="grid grid-cols-2 gap-1.5 max-h-80 overflow-y-auto pr-0.5">
          {palettes.map((palette) => {
            const isActive = palette.id === activePaletteId
            return (
              <button
                key={palette.id}
                onClick={() => setPaletteId(palette.id)}
                className={cn(
                  'flex flex-col gap-2 rounded-lg border p-2.5 text-left transition-all hover:border-primary/50 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                    : 'border-border bg-transparent'
                )}
                aria-pressed={isActive}
              >
                {/* Swatch row */}
                <div className="flex gap-1">
                  {palette.swatches.map((color, i) => (
                    <span
                      key={i}
                      className="h-4 flex-1 rounded-sm"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                {/* Label */}
                <div>
                  <p className={cn('text-xs font-semibold', isActive ? 'text-primary' : 'text-foreground')}>
                    {palette.name}
                  </p>
                  <p className="text-[10px] leading-tight text-muted-foreground">
                    {palette.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
