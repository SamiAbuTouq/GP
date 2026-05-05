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
    default: 'bg-card border-border/90',
    primary: 'bg-card border-border/90',
    success: 'bg-card border-border/90',
    warning: 'bg-card border-border/90',
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
    <Card
      className={cn(
        'relative overflow-hidden rounded-2xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
        variantStyles[variant],
        className,
      )}
    >
      <CardContent className="p-3.5 md:p-4">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/90">{title}</span>
              {methodBadge && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className="h-4 rounded-sm border border-border bg-muted px-1.5 text-[10px] font-semibold tracking-wide text-foreground/80">
                      {methodBadge.label}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top">{methodBadge.title}</TooltipContent>
                </Tooltip>
              )}
            </div>
            <span className={cn(
              'text-lg font-bold tracking-tight sm:text-xl',
              valueStyles[variant]
            )}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
            {description && (
              <span className="line-clamp-2 text-[11px] text-muted-foreground">{description}</span>
            )}
            {trend && (
              <span className={cn(
                'mt-0.5 text-[11px] font-medium text-muted-foreground'
              )}>
                {trend.isPositive ? '+' : ''}{trend.value}% vs last semester
              </span>
            )}
          </div>
          {Icon && (
            <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconStyles[variant])}>
              <Icon className="h-4 w-4" />
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
    <div className={cn('flex items-center gap-2 rounded-md p-0.5', highlight && 'bg-muted/60')}>
      {Icon && (
        <div className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
          'bg-muted'
        )}>
          <Icon className={cn(
            'h-3 w-3 text-muted-foreground'
          )} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn(
          'text-[15px] font-semibold leading-tight text-foreground'
        )}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="truncate text-[10px] text-muted-foreground">{label}</p>
        {subValue && (
          <p className="truncate text-[9px] text-muted-foreground/70">{subValue}</p>
        )}
      </div>
    </div>
  )
}
