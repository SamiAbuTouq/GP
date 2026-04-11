"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  BookOpen,
  UserCog,
  DoorOpen,
  Clock,
  LogOut,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "@/lib/sidebar-context";

const mainNavItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    title: "Timetable Generation",
    href: "/timetable-generation",
    icon: Calendar,
  },
  { title: "What-If Scenarios", href: "/what-if", icon: FlaskConical },
  { title: "Schedule Viewer", href: "/schedule", icon: Eye },
];

const entityNavItems = [
  { title: "Courses", href: "/entity/courses", icon: BookOpen },
  { title: "Lecturers", href: "/entity/lecturers", icon: UserCog },
  { title: "Rooms", href: "/entity/rooms", icon: DoorOpen },
  { title: "Time Slots", href: "/entity/timeslots", icon: Clock },
];

const otherNavItems = [
  { title: "Reports", href: "/reports", icon: FileText },
  { title: "Settings", href: "/settings", icon: Settings },
];

const helpNavItem = {
  title: "Help & Support",
  href: "/help",
  icon: HelpCircle,
};

function NavButton({
  href,
  icon: Icon,
  title,
  isActive,
  collapsed,
  onClick,
  className,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  isActive: boolean;
  collapsed: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const btn = collapsed ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href={href} onClick={onClick} className="flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-9 w-9 rounded-lg transition-colors shrink-0",
              "border-0 outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none",
              isActive
                ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground bg-transparent",
              className,
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
          </Button>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" className="font-medium">
        {title}
      </TooltipContent>
    </Tooltip>
  ) : (
    <Link href={href} onClick={onClick} className="block w-full">
      <Button
        variant="ghost"
        className={cn(
          "mx-auto w-[calc(100%-0.25rem)] rounded-lg transition-colors justify-start gap-3 px-3 py-2.5",
          "border-0 outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none",
          isActive
            ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground bg-transparent",
          className,
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="flex-1 text-left text-sm font-medium">{title}</span>
      </Button>
    </Link>
  );

  return btn;
}

function SidebarNavigation({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [entityOpen, setEntityOpen] = useState(pathname.startsWith("/entity"));

  return (
    <ScrollArea className="flex-1 py-4">
      <div className={cn("space-y-1", collapsed ? "flex flex-col items-center px-0" : "pl-3 pr-[15px]")}>
        {mainNavItems.map((item) => (
          <NavButton
            key={item.href}
            href={item.href}
            icon={item.icon}
            title={item.title}
            isActive={pathname === item.href}
            collapsed={collapsed}
            onClick={onNavigate}
          />
        ))}

        {/* Entity Management section */}
        <div className="pt-3">
          {collapsed ? (
            /* In collapsed mode, show entity icons individually */
            entityNavItems.map((item) => (
              <NavButton
                key={item.href}
                href={item.href}
                icon={item.icon}
                title={item.title}
                isActive={pathname === item.href}
                collapsed={collapsed}
                onClick={onNavigate}
              />
            ))
          ) : (
            <Collapsible open={entityOpen} onOpenChange={setEntityOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "mx-auto w-[calc(100%-0.25rem)] justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
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
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform duration-200",
                      entityOpen && "rotate-180",
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-0.5 pt-1">
                {entityNavItems.map((item) => (
                  <Link key={item.href} href={item.href} onClick={onNavigate} className="block w-full">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "mx-auto w-[calc(100%-0.25rem)] justify-start gap-3 rounded-lg py-2 pl-11 text-sm transition-colors",
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
          )}
        </div>

        <div className="pt-3">
          {otherNavItems.map((item) => (
            <NavButton
              key={item.href}
              href={item.href}
              icon={item.icon}
              title={item.title}
              isActive={pathname === item.href}
              collapsed={collapsed}
              onClick={onNavigate}
            />
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const { collapsed, toggle } = useSidebar();

  const handleNavigate = () => {
    onNavigate?.();
  };

  const handleLogout = async () => {
    onNavigate?.();
    await logout();
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex h-full flex-col bg-sidebar">
        {/* Logo Section */}
        <div className={cn("flex h-16 items-center border-b border-sidebar-border", collapsed ? "justify-center px-2" : "gap-3 px-5")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center">
            <Image
              src="/images/psut-logo.png"
              alt="PSUT Logo"
              width={36}
              height={36}
              className="object-contain"
              style={{ width: "auto", height: "auto" }}
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold text-sidebar-foreground">
                PSUT
              </span>
              <span className="text-xs text-muted-foreground truncate">
                Timetabling System
              </span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <Suspense fallback={<div className="flex-1" />}>
          <SidebarNavigation collapsed={collapsed} onNavigate={handleNavigate} />
        </Suspense>

        {/* Bottom Navigation */}
        <div className={cn("border-t border-sidebar-border py-3 space-y-1", collapsed ? "flex flex-col items-center px-0" : "pl-3 pr-[15px]")}>
          <NavButton
            href={helpNavItem.href}
            icon={helpNavItem.icon}
            title={helpNavItem.title}
            isActive={pathname === helpNavItem.href}
            collapsed={collapsed}
            onClick={handleNavigate}
          />
          {/* Logout */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg border-0 outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground bg-transparent"
                  onClick={handleLogout}
                >
                  <LogOut className="h-5 w-5 shrink-0" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium">Logout</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              className="mx-auto w-[calc(100%-0.25rem)] justify-start gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors border-0 outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground bg-transparent"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span>Logout</span>
            </Button>
          )}
          {/* Collapse toggle */}
          <div className={cn("pt-1", collapsed ? "flex justify-center" : "")}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={toggle}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

export function Sidebar() {
  const { collapsed } = useSidebar();
  const [transitionsEnabled, setTransitionsEnabled] = useState(false);

  useEffect(() => {
    setTransitionsEnabled(true);
  }, []);

  return (
    <aside
      className={cn(
        "hidden border-r border-sidebar-border bg-sidebar lg:block shrink-0",
        transitionsEnabled && "transition-all duration-300 ease-in-out",
        collapsed ? "w-12" : "w-56",
      )}
    >
      <SidebarContent />
    </aside>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

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
      <SheetContent
        side="left"
        className="w-64 p-0 border-0 bg-sidebar [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        {/* Mobile always shows expanded; provide a dummy useSidebar via its own state */}
        <MobileSidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

// Mobile sidebar uses its own non-collapsible content (always expanded)
function MobileSidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [entityOpen, setEntityOpen] = useState(pathname.startsWith("/entity"));

  const handleLogout = async () => {
    onNavigate?.();
    await logout();
  };

  const getNavItemClasses = (isActive: boolean) =>
    cn(
      "w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
      "border-0 outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none",
      isActive
        ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground bg-transparent",
    );

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="flex h-9 w-9 items-center justify-center">
          <Image
            src="/images/psut-logo.png"
            alt="PSUT Logo"
            width={36}
            height={36}
            className="object-contain"
            style={{ width: "auto", height: "auto" }}
          />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold text-sidebar-foreground">PSUT</span>
          <span className="text-xs text-muted-foreground">Timetabling System</span>
        </div>
      </div>

      <ScrollArea className="flex-1 py-4">
        <div className="space-y-1 px-3">
          {mainNavItems.map((item) => (
            <Link key={item.href} href={item.href} onClick={onNavigate} className="block w-full">
              <Button variant="ghost" className={getNavItemClasses(pathname === item.href)}>
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="flex-1 text-left">{item.title}</span>
              </Button>
            </Link>
          ))}

          <div className="pt-3">
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
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", entityOpen && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-0.5 pt-1">
                {entityNavItems.map((item) => (
                  <Link key={item.href} href={item.href} onClick={onNavigate} className="block w-full">
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

          <div className="pt-3">
            {otherNavItems.map((item) => (
              <Link key={item.href} href={item.href} onClick={onNavigate} className="block w-full">
                <Button variant="ghost" className={getNavItemClasses(pathname === item.href)}>
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span>{item.title}</span>
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </ScrollArea>

      <div className="border-t border-sidebar-border px-3 py-3 space-y-1">
        <Link href={helpNavItem.href} onClick={onNavigate} className="block w-full">
          <Button variant="ghost" className={getNavItemClasses(pathname === helpNavItem.href)}>
            <helpNavItem.icon className="h-5 w-5 shrink-0" />
            <span>{helpNavItem.title}</span>
          </Button>
        </Link>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors border-0 outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground bg-transparent"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span>Logout</span>
        </Button>
      </div>
    </div>
  );
}
