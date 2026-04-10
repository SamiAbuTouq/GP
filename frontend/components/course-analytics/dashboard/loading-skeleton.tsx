'use client'

import { Skeleton } from '@/components/course-analytics-ui/skeleton'

export function LoadingSkeleton() {
  return (
    <main className="relative min-h-screen bg-background overflow-hidden">
      <div className="mesh-background opacity-20" />
      
      {/* High-Fidelity Desktop Mockup */}
      <div className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-64" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-40 rounded-xl" />
            <Skeleton className="h-10 w-10 rounded-xl" />
          </div>
        </div>

        {/* Filter Bar Mockup */}
        <div className="mb-8 p-1 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm">
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>

        {/* KPI Grid */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/5 p-6 bg-white/5 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
              <Skeleton className="h-9 w-32 mb-2" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>

        {/* Second KPI row */}
        <div className="mb-8 p-1 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm">
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>

        {/* Tabs mockup */}
        <div className="mb-8 flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-32 rounded-xl" />
          ))}
        </div>

        {/* Major Charts Mockup */}
        <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
                <div className="rounded-2xl border border-white/5 p-6 bg-white/5 backdrop-blur-sm">
                    <Skeleton className="h-8 w-48 mb-6" />
                    <Skeleton className="h-[400px] w-full rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                    <div className="rounded-2xl border border-white/5 p-6 bg-white/5 backdrop-blur-sm">
                        <Skeleton className="h-6 w-32 mb-4" />
                        <Skeleton className="h-[300px] w-full rounded-xl" />
                    </div>
                    <div className="rounded-2xl border border-white/5 p-6 bg-white/5 backdrop-blur-sm">
                        <Skeleton className="h-6 w-32 mb-4" />
                        <Skeleton className="h-[300px] w-full rounded-xl" />
                    </div>
                </div>
            </div>
            <div className="space-y-6">
                <div className="rounded-2xl border border-white/5 p-6 bg-white/5 backdrop-blur-sm">
                    <Skeleton className="h-8 w-48 mb-6" />
                    <Skeleton className="h-[800px] w-full rounded-xl" />
                </div>
            </div>
        </div>
      </div>
    </main>
  )
}


