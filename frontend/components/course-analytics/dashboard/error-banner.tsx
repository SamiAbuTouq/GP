'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/course-analytics-ui/button'

interface ErrorBannerProps {
  message?: string
  onRetry?: () => void
}

export function ErrorBanner({
  message = 'Something went wrong while loading the data.',
  onRetry,
}: ErrorBannerProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="mx-auto max-w-md px-6 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
        </div>
        <h2 className="mb-2 text-xl font-bold text-foreground">Failed to Load Data</h2>
        <p className="mb-6 text-sm text-muted-foreground">{message}</p>
        {onRetry && (
          <Button onClick={onRetry} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        )}
      </div>
    </main>
  )
}
