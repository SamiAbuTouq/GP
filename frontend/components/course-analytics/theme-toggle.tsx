'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useCourseAnalyticsTheme } from '@/lib/course-analytics/analytics-theme-context'

import { Button } from '@/components/course-analytics-ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/course-analytics-ui/dropdown-menu'

export function ThemeToggle() {
  const { setTheme } = useCourseAnalyticsTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full px-0">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all ca-dark:-rotate-90 ca-dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all ca-dark:rotate-0 ca-dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
