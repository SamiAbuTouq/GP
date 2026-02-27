"use client"

import type React from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"

interface EntityLayoutProps {
  children: React.ReactNode
  title: string
  description: string
}

export function EntityLayout({ children, title, description }: EntityLayoutProps) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-balance">{title}</h1>
            <p className="text-muted-foreground">{description}</p>
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}
