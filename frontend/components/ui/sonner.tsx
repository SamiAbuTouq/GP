'use client'

import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Toaster as Sonner, ToasterProps } from 'sonner'

/** Above Radix dialogs (z ~100–110), sheets, and overlays. */
const TOASTER_Z_INDEX = 2_147_483_000

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const sonnerEl = (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group !pointer-events-auto"
      closeButton
      toastOptions={{
        duration: 4000,
        closeButton: true,
        classNames: {
          error: 'group-[.toaster]:text-destructive',
          /** Re-enable clicks: parent portal layer is pointer-events-none for Radix modals/sheets */
          toast: '!pointer-events-auto',
          /** Top-end (top-right in LTR). Sonner defaults use top-start for [dir=ltr]. */
          closeButton:
            '!left-auto !right-2 top-2 z-[5] !flex size-7 !translate-x-0 !translate-y-0 items-center justify-center rounded-md border bg-background text-foreground shadow-none hover:bg-muted [&_svg]:size-4 !pointer-events-auto',
        },
      }}
      icons={{
        close: <X aria-hidden className="size-4 shrink-0" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          zIndex: TOASTER_Z_INDEX,
        } as CSSProperties
      }
      {...props}
    />
  )

  if (!mounted) return null

  /*
   * Radix modal sheets stack a full-screen overlay that wins hit-testing unless we isolate the
   * toast layer above it. Outer shell is pointer-events:none so empty areas remain clickable "through",
   * but Sonner restores pointer-events on toasts and close buttons (see CSS above).
   */
  return createPortal(
    <div
      data-surface="toast-hit-layer"
      className="pointer-events-none fixed inset-0 isolate"
      style={{ zIndex: TOASTER_Z_INDEX }}
    >
      {sonnerEl}
    </div>,
    document.body,
  )
}

export { Toaster }
