'use client'

import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

import { cn } from '@/lib/utils'

/** @deprecated Use default {@link TooltipContent} styles instead. */
export const tooltipRichContentClass =
  'max-w-[min(22rem,calc(100vw-2rem))] text-left leading-relaxed text-pretty'

const tooltipContentClass =
  'bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit max-w-[min(22rem,calc(100vw-2rem))] origin-(--radix-tooltip-content-transform-origin) overflow-visible rounded-xl border border-border/80 px-3.5 py-2.5 text-xs text-left leading-relaxed text-pretty shadow-lg'

/** Lucide (or similar) icons inside tooltips — muted, theme-aware. */
export const tooltipIconClass = 'h-3.5 w-3.5 shrink-0 text-muted-foreground'

/**
 * Wide speech-bubble tail. Must use `asChild` + a single SVG — Radix ignores extra children
 * and would otherwise render only its tiny default polygon (~10×5px).
 */
const TOOLTIP_ARROW_WIDTH = 32
const TOOLTIP_ARROW_HEIGHT = 14

/** Sharp isosceles triangle — tip at top center; Radix rotates toward the anchor. */
const tooltipArrowPoints = `0,${TOOLTIP_ARROW_HEIGHT} ${TOOLTIP_ARROW_WIDTH},${TOOLTIP_ARROW_HEIGHT} ${TOOLTIP_ARROW_WIDTH / 2},0`

function TooltipArrow() {
  return (
    <TooltipPrimitive.Arrow asChild width={TOOLTIP_ARROW_WIDTH} height={TOOLTIP_ARROW_HEIGHT}>
      <svg
        width={TOOLTIP_ARROW_WIDTH}
        height={TOOLTIP_ARROW_HEIGHT}
        viewBox={`0 0 ${TOOLTIP_ARROW_WIDTH} ${TOOLTIP_ARROW_HEIGHT}`}
        style={{ width: TOOLTIP_ARROW_WIDTH, height: TOOLTIP_ARROW_HEIGHT, display: 'block' }}
        className="z-[60] block shrink-0 overflow-visible drop-shadow-[0_2px_6px_rgba(0,0,0,0.14)]"
        aria-hidden
      >
        <polygon points={tooltipArrowPoints} fill="var(--popover)" />
      </svg>
    </TooltipPrimitive.Arrow>
  )
}

function TooltipProvider({
  delayDuration = 250,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

/** Use inside a {@link TooltipProvider} (app root). Renders only the Radix root — no nested provider. */
const Tooltip = TooltipPrimitive.Root

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 8,
  align = 'center',
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        align={align}
        className={cn(tooltipContentClass, className)}
        {...props}
      >
        {children}
        <TooltipArrow />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

/** Vertical stack for multi-part tooltip copy. */
function TooltipBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="tooltip-body" className={cn('space-y-2.5', className)} {...props} />
}

function TooltipTitle({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="tooltip-title"
      className={cn('font-semibold text-popover-foreground', className)}
      {...props}
    />
  )
}

function TooltipMuted({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="tooltip-muted"
      className={cn('text-muted-foreground', className)}
      {...props}
    />
  )
}

function TooltipDivider({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="tooltip-divider"
      role="presentation"
      className={cn('border-t border-border', className)}
      {...props}
    />
  )
}

function TooltipSection({
  className,
  title,
  children,
}: {
  className?: string
  title?: string
  children: React.ReactNode
}) {
  return (
    <div data-slot="tooltip-section" className={cn('space-y-2', className)}>
      {title ? (
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
      ) : null}
      {children}
    </div>
  )
}

function TooltipList({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul data-slot="tooltip-list" className={cn('space-y-1.5', className)} {...props} />
}

function TooltipListItem({ className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="tooltip-list-item"
      className={cn('flex items-center gap-2 text-popover-foreground', className)}
      {...props}
    />
  )
}

/** Highlighted example / callout block inside a tooltip. */
function TooltipInset({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="tooltip-inset"
      className={cn('rounded-md border border-border/60 bg-muted/50 px-2.5 py-2', className)}
      {...props}
    />
  )
}

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  TooltipBody,
  TooltipTitle,
  TooltipMuted,
  TooltipDivider,
  TooltipSection,
  TooltipList,
  TooltipListItem,
  TooltipInset,
  tooltipIconClass,
}
