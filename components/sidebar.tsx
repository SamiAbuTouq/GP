"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
  LayoutDashboard,
  Calendar,
  FlaskConical,
  Eye,
  Users,
  FileText,
  Settings,
  Menu,
  ChevronDown,
  GraduationCap,
  BookOpen,
  UserCog,
  DoorOpen,
  Clock,
  LogOut,
  HelpCircle,
} from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

const mainNavItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Timetable Generation", href: "/timetable-generation", icon: Calendar },
  { title: "What-If Scenarios", href: "/what-if", icon: FlaskConical },
  { title: "Schedule Viewer", href: "/schedule", icon: Eye },
]

const entityNavItems = [
  { title: "Students", href: "/entity/students", icon: GraduationCap },
  { title: "Courses", href: "/entity/courses", icon: BookOpen },
  { title: "Lecturers", href: "/entity/lecturers", icon: UserCog },
  { title: "Rooms", href: "/entity/rooms", icon: DoorOpen },
  { title: "Time Slots", href: "/entity/timeslots", icon: Clock },
]

const otherNavItems = [
  { title: "Reports", href: "/reports", icon: FileText },
  { title: "Settings", href: "/settings", icon: Settings },
]

const bottomNavItems = [
  { title: "Help & Support", href: "/help", icon: HelpCircle },
  { title: "Logout", href: "/login", icon: LogOut },
]

function SidebarNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const [entityOpen, setEntityOpen] = useState(pathname.startsWith("/entity"))

  const getNavItemClasses = (isActive: boolean) =>
    cn(
      "w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
      "border-0 outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none",
      isActive
        ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground bg-transparent",
    )

  return (
    <ScrollArea className="flex-1 px-4 py-6">
      <div className="space-y-1">
        {mainNavItems.map((item) => (
          <Link key={item.href} href={item.href} onClick={onNavigate}>
            <Button variant="ghost" className={getNavItemClasses(pathname === item.href)}>
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="flex-1 text-left">{item.title}</span>
            </Button>
          </Link>
        ))}

        <div className="pt-4">
          <Collapsible open={entityOpen} onOpenChange={setEntityOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  "border-0 outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none",
                  pathname.startsWith("/entity")
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground bg-transparent",
                )}
              >
                <span className="flex items-center gap-3">
                  <Users className="h-5 w-5 shrink-0" />
                  Entity Management
                </span>
                <ChevronDown
                  className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", entityOpen && "rotate-180")}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5 pt-1">
              {entityNavItems.map((item) => (
                <Link key={item.href} href={item.href} onClick={onNavigate}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "w-full justify-start gap-3 rounded-lg py-2 pl-11 text-sm transition-colors",
                      "border-0 outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none",
                      pathname === item.href
                        ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground font-medium"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground bg-transparent",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.title}
                  </Button>
                </Link>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="pt-4">
          {otherNavItems.map((item) => (
            <Link key={item.href} href={item.href} onClick={onNavigate}>
              <Button variant="ghost" className={getNavItemClasses(pathname === item.href)}>
                <item.icon className="h-5 w-5 shrink-0" />
                <span>{item.title}</span>
              </Button>
            </Link>
          ))}
        </div>
      </div>
    </ScrollArea>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  const getBottomNavClasses = (isActive: boolean) =>
    cn(
      "w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
      "border-0 outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none",
      isActive
        ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground bg-transparent",
    )

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Logo Section */}
      <div className="flex h-[72px] items-center gap-3 border-b border-sidebar-border px-5">
        <div className="flex h-11 w-11 items-center justify-center">
          <Image src="/images/psut-logo.png" alt="PSUT Logo" width={44} height={44} className="object-contain" style={{ width: 'auto', height: 'auto' }} />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold text-sidebar-foreground">PSUT</span>
          <span className="text-xs text-muted-foreground">Timetabling System</span>
        </div>
      </div>

      {/* Navigation */}
      <Suspense fallback={<div className="flex-1" />}>
        <SidebarNavigation onNavigate={onNavigate} />
      </Suspense>

      {/* Bottom Navigation */}
      <div className="border-t border-sidebar-border px-4 py-4 space-y-1">
        {bottomNavItems.map((item) => (
          <Link key={item.href} href={item.href} onClick={onNavigate}>
            <Button variant="ghost" className={getBottomNavClasses(pathname === item.href)}>
              <item.icon className="h-5 w-5 shrink-0" />
              <span>{item.title}</span>
            </Button>
          </Link>
        ))}
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 border-r border-sidebar-border bg-sidebar lg:block">
      <SidebarContent />
    </aside>
  )
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-lg border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0 border-0 bg-sidebar [&>button]:hidden">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <SidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
