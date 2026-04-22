import type React from "react"
import type { Metadata } from "next"
import { cookies } from "next/headers"
import { Inter, JetBrains_Mono } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthProvider } from "@/lib/auth-context"
import { SidebarProvider } from "@/lib/sidebar-context"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: "University Timetabling - PSUT",
  description: "University Timetabling System - Automated scheduling for optimal resource utilization",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/images/psut-logo.png", type: "image/png" },
    ],
    apple: "/images/psut-logo.png",
  },
  generator: "v0.app",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const initialSidebarCollapsed =
    cookieStore.get("psut-sidebar-collapsed")?.value === "true"

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <AuthProvider>
              <SidebarProvider initialCollapsed={initialSidebarCollapsed}>
                {children}
                <Toaster />
              </SidebarProvider>
            </AuthProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
