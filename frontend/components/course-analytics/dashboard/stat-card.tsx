'use client'

import { Card, CardContent } from '@/components/course-analytics-ui/card'
import { Badge } from '@/components/course-analytics-ui/badge'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  methodBadge?: {
    label: string
    title: string
  }
  variant?: 'default' | 'primary' | 'success' | 'warning'
  className?: string
}

export function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon,
  trend,
  methodBadge,
  variant = 'default',
  className 
}: StatCardProps) {
  const variantStyles = {
    default: 'bg-card border-border',
    primary: 'bg-card border-border',
    success: 'bg-card border-border',
    warning: 'bg-card border-border',
  }

  const iconStyles = {
    default: 'bg-muted text-muted-foreground',
    primary: 'bg-muted text-muted-foreground',
    success: 'bg-muted text-muted-foreground',
    warning: 'bg-muted text-muted-foreground',
  }

  const valueStyles = {
    default: 'text-foreground',
    primary: 'text-foreground',
    success: 'text-foreground',
    warning: 'text-foreground',
  }

  return (
    <Card className={cn('relative overflow-hidden transition-all hover:shadow-lg', variantStyles[variant], className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">{title}</span>
              {methodBadge && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className="h-5 rounded-sm border-0 bg-primary/15 px-1.5 text-[10px] font-semibold tracking-wide text-primary">
                      {methodBadge.label}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top">{methodBadge.title}</TooltipContent>
                </Tooltip>
              )}
            </div>
            <span className={cn(
              "text-xl font-bold tracking-tight sm:text-2xl",
              valueStyles[variant]
            )}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
            {description && (
              <span className="text-xs text-muted-foreground">{description}</span>
            )}
            {trend && (
              <span className={cn(
                'mt-0.5 text-xs font-medium',
                trend.isPositive ? 'text-chart-3' : 'text-destructive'
              )}>
                {trend.isPositive ? '+' : ''}{trend.value}% vs last semester
              </span>
            )}
          </div>
          {Icon && (
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', iconStyles[variant])}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface MiniStatProps {
  label: string
  value: string | number
  subValue?: string
  icon?: LucideIcon
  highlight?: boolean
}

export function MiniStat({ label, value, subValue, icon: Icon, highlight = false }: MiniStatProps) {
  return (
    <div className="flex items-center gap-3">
      {Icon && (
        <div className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          highlight ? "bg-chart-4/15" : "bg-muted"
        )}>
          <Icon className={cn(
            "h-4 w-4",
            highlight ? "text-chart-4" : "text-muted-foreground"
          )} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn(
          "text-lg font-bold leading-tight",
          highlight && "text-chart-4"
        )}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        {subValue && (
          <p className="truncate text-[10px] text-muted-foreground/70">{subValue}</p>
        )}
      </div>
    </div>
  )
}
