"use client"

import type React from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"

interface EntityLayoutProps {
  children: React.ReactNode
  title: string
  description: string
  headerActions?: React.ReactNode
}

export function EntityLayout({ children, title, description, headerActions }: EntityLayoutProps) {
  return (
    <div className="relative flex h-screen">
      <Sidebar />
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="mx-auto w-full max-w-[1680px]">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-balance">{title}</h1>
                <p className="text-muted-foreground">{description}</p>
              </div>
              {headerActions ? <div className="shrink-0">{headerActions}</div> : null}
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
