"use client";

import { forwardRef, useEffect, useRef, useState, Suspense } from "react";
import { motion } from "motion/react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Menu,
  DoorOpen,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { LayoutGridIcon } from "@/components/ui/layout-grid";
import { FlaskIcon } from "@/components/ui/flask";
import { EyeIcon } from "@/components/ui/eye-icon";
import { FileTextIcon } from "@/components/ui/file-text-icon";
import { TimetableGenerationLottieIcon } from "@/components/ui/timetable-generation-lottie-icon";
import { HelpCenterLottieIcon } from "@/components/ui/help-center-lottie-icon";
import { SettingsIcon } from "@/components/ui/settings-icon";
import { LogoutIcon } from "@/components/ui/logout-icon";
import { ChevronDownIcon } from "@/components/ui/chevron-down-icon";
import { UsersRoundIcon } from "@/components/ui/users-round-icon";
import { UserRoundIcon } from "@/components/ui/user-round-icon";
import { UserRoundPlusIcon } from "@/components/ui/user-round-plus-icon";
import { ClockIcon } from "@/components/ui/clock";
import { BookOpenTextIcon } from "@/components/ui/book-open-text-icon";
import { GraduationCapIcon } from "@/components/ui/graduation-cap";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "@/lib/sidebar-context";
import { navActivePillRadiusClass } from "@/lib/segmented-nav-tabs";
import { Skeleton } from "@/components/ui/skeleton";

function useSidebarNavVisibility() {
  const { user, authLoading } = useAuth();
  const isLecturer = user?.role === "LECTURER";

  return {
    authLoading,
    showLecturerNav: !authLoading && isLecturer,
    showAdminNav: !authLoading && !!user && !isLecturer,
  };
}

function SidebarNavSkeleton({ collapsed }: { collapsed: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "flex flex-col space-y-1.5",
        collapsed ? "w-full items-center px-0" : "px-3",
      )}
      aria-busy="true"
      aria-label="Loading navigation"
    >
      {Array.from({ length: collapsed ? 4 : 6 }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn(
            "rounded-lg bg-sidebar-accent/60",
            collapsed ? "h-9 w-9" : "h-9 w-full",
          )}
        />
      ))}
    </motion.div>
  );
}

interface AnimatedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

type NavItem = {
  title: string;
  href: string;
  icon: React.ElementType;
  animated?: boolean;
  iconSize?: number;
  iconClassName?: string;
};

const DashboardNavIcon = forwardRef<AnimatedIconHandle, { className?: string; size?: number }>(
  ({ className, size = 20 }, ref) => <LayoutGridIcon ref={ref} size={size} className={className} />,
);

DashboardNavIcon.displayName = "DashboardNavIcon";


const mainNavItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: DashboardNavIcon, animated: true },
  {
    title: "Timetable Generation",
    href: "/timetable-generation",
    icon: TimetableGenerationLottieIcon,
    animated: true,
    iconSize: 22,
    iconClassName: "dark:brightness-0 dark:invert",
  },
  { title: "What-If Scenarios", href: "/dashboard/what-if", icon: FlaskIcon, animated: true, iconSize: 20 },
  { title: "Schedule Viewer", href: "/schedule", icon: EyeIcon, animated: true },
];

const entityNavItems: NavItem[] = [
  { title: "Courses", href: "/entity/courses", icon: BookOpenTextIcon, animated: true },
  { title: "Lecturers", href: "/entity/lecturers", icon: UserRoundIcon, animated: true },
  { title: "Rooms", href: "/entity/rooms", icon: DoorOpen },
  { title: "Time Slots", href: "/entity/timeslots", icon: ClockIcon, animated: true },
  { title: "Study Plans", href: "/entity/study-plans", icon: GraduationCapIcon, animated: true },
];

/** Entity Management accordion — excludes e.g. /entity/access-requests (moved to footer nav). */
function isEntityManagementSectionActive(pathname: string): boolean {
  return entityNavItems.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}

const otherNavItems: NavItem[] = [
  { title: "Reports", href: "/reports", icon: FileTextIcon, animated: true },
];

const accessRequestsNavItem = {
  title: "Access Requests",
  href: "/entity/access-requests",
  icon: UserRoundPlusIcon,
  animated: true,
};

const helpNavItem = {
  title: "Help & Support",
  href: "/help",
  icon: HelpCenterLottieIcon,
  animated: true,
  iconSize: 22,
  iconClassName: "dark:brightness-0 dark:invert",
};

const settingsNavItem = {
  title: "Settings",
  href: "/settings",
  icon: SettingsIcon,
  animated: true,
};

const lecturerNavItems: NavItem[] = [
  { title: "Time Preference", href: "/lecturer-time-preferences", icon: ClockIcon, animated: true },
  { title: "Schedule Viewer", href: "/lecturer-schedule", icon: EyeIcon, animated: true },
  { title: "My Courses", href: "/my-courses", icon: BookOpenTextIcon, animated: true },
];

function NavButton({
  href,
  icon: Icon,
  title,
  isActive,
  collapsed,
  onClick,
  className,
  isSubItem,
  animated = false,
  iconSize,
  iconClassName,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  isActive: boolean;
  collapsed: boolean;
  onClick?: () => void;
  className?: string;
  isSubItem?: boolean;
  animated?: boolean;
  iconSize?: number;
  iconClassName?: string;
}) {
  const iconRef = useRef<AnimatedIconHandle | null>(null);
  const resolvedIconSize = iconSize ?? (isSubItem ? 16 : 20);
  const AnimatedIcon = Icon as React.ForwardRefExoticComponent<
    { className?: string; size?: number } & React.RefAttributes<AnimatedIconHandle>
  >;

  const content = (
    <Link
      href={href}
      onClick={onClick}
      className={collapsed ? "flex justify-center" : "block w-full min-w-0"}
    >
      <Button
        variant="ghost"
        onMouseEnter={() => iconRef.current?.startAnimation()}
        onMouseLeave={() => iconRef.current?.stopAnimation()}
        className={cn(
          `relative mx-auto ${navActivePillRadiusClass} border-0 outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none`,
          "transition-colors duration-200 ease-in-out",
          collapsed
            ? "h-9 w-9 justify-center px-0 py-0 my-0.5"
            : cn(
                "w-full min-w-0 justify-start overflow-hidden",
                isSubItem ? "gap-2 py-1 pl-8" : "gap-2.5 px-2 py-1.5",
              ),
          isActive
            ? "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground bg-transparent",
          className,
        )}
      >
        {isActive ? (
          <motion.span
            layoutId="active-nav-indicator"
            className={cn(
              "absolute left-0 w-1 rounded-r-full bg-primary",
              isSubItem ? "inset-y-0.5" : "inset-y-1",
            )}
            transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
          />
        ) : null}
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center",
            collapsed && "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            iconClassName,
          )}
          style={{ width: resolvedIconSize, height: resolvedIconSize }}
        >
          {animated ? (
            <AnimatedIcon
              ref={iconRef}
              size={resolvedIconSize}
              className="inline-flex items-center justify-center"
            />
          ) : (
            <Icon
              size={resolvedIconSize}
              className="inline-flex items-center justify-center"
            />
          )}
        </span>
        <span
          className={cn(
            "min-w-0 overflow-hidden text-left text-sm font-medium transition-[max-width,opacity,transform] duration-200 ease-in-out",
            collapsed
              ? "max-w-0 shrink-0 whitespace-nowrap opacity-0 -translate-x-1"
              : "flex-1 truncate opacity-100 translate-x-0",
          )}
        >
          {title}
        </span>
      </Button>
    </Link>
  );

  if (!collapsed) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="right">{title}</TooltipContent>
    </Tooltip>
  );
}

function SidebarNavigation({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { authLoading, showLecturerNav, showAdminNav } = useSidebarNavVisibility();
  const [entityOpen, setEntityOpen] = useState(() => isEntityManagementSectionActive(pathname));
  const entityRef = useRef<AnimatedIconHandle | null>(null);

  useEffect(() => {
    if (isEntityManagementSectionActive(pathname)) setEntityOpen(true);
  }, [pathname]);

  return (
    <ScrollArea className="min-w-0 flex-1 py-2">
      <div
        className={cn(
          "flex min-w-0 flex-col space-y-1 transition-all duration-200 ease-in-out",
          collapsed ? "w-full items-center px-0" : "px-3",
        )}
      >
        {authLoading && <SidebarNavSkeleton collapsed={collapsed} />}

        {showAdminNav && mainNavItems.map((item) => (
          <NavButton
            key={item.href}
            href={item.href}
            icon={item.icon}
            title={item.title}
            isActive={pathname === item.href}
            collapsed={collapsed}
            onClick={onNavigate}
            animated={item.animated}
            iconSize={item.iconSize}
            iconClassName={item.iconClassName}
          />
        ))}

        {/* Entity Management section */}
        {showAdminNav && (
          <div className="pt-0">
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
                animated={item.animated}
                iconSize={item.iconSize}
                iconClassName={item.iconClassName}
              />
            ))
            ) : (
              <Collapsible open={entityOpen} onOpenChange={setEntityOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  onMouseEnter={() => entityRef.current?.startAnimation()}
                  onMouseLeave={() => entityRef.current?.stopAnimation()}
                  className={cn(
                    "w-full min-w-0 justify-between gap-2 overflow-hidden rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
                    "border-0 outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none",
                    isEntityManagementSectionActive(pathname)
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground bg-transparent",
                  )}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <UsersRoundIcon ref={entityRef} size={20} className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 truncate text-left">Entity Management</span>
                  </span>
                  <ChevronDownIcon
                    size={16}
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      entityOpen && "rotate-180",
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pt-0">
                {entityNavItems.map((item) => (
                  <NavButton
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    title={item.title}
                    isActive={pathname === item.href}
                    collapsed={collapsed}
                    onClick={onNavigate}
                    isSubItem={true}
                    animated={item.animated}
                    iconSize={item.iconSize}
                    iconClassName={item.iconClassName}
                  />
                ))}
              </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}

        {showAdminNav && (
          <div className="pt-0">
            {otherNavItems.map((item) => (
              <NavButton
                key={item.href}
                href={item.href}
                icon={item.icon}
                title={item.title}
                isActive={pathname === item.href}
                collapsed={collapsed}
                onClick={onNavigate}
                animated={item.animated}
                iconSize={item.iconSize}
                iconClassName={item.iconClassName}
              />
            ))}
          </div>
        )}

        {showLecturerNav && (
          <div className="pt-0">
            {lecturerNavItems.map((item) => (
              <NavButton
                key={item.href}
                href={item.href}
                icon={item.icon}
                title={item.title}
                isActive={pathname === item.href}
                collapsed={collapsed}
                onClick={onNavigate}
                animated={item.animated}
                iconSize={item.iconSize}
                iconClassName={item.iconClassName}
              />
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const { showAdminNav } = useSidebarNavVisibility();
  const { collapsed, toggle } = useSidebar();
  const logoutRef = useRef<AnimatedIconHandle | null>(null);

  const handleNavigate = () => {
    onNavigate?.();
  };

  const handleLogout = async () => {
    onNavigate?.();
    await logout();
  };

  const logoutButton = (
      <Button
        variant="ghost"
        onClick={handleLogout}
        onMouseEnter={() => logoutRef.current?.startAnimation()}
        onMouseLeave={() => logoutRef.current?.stopAnimation()}
        className={cn(
          "rounded-lg border-0 outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none",
          "transition-colors transition-[width,padding,opacity,transform] duration-200 ease-in-out",
          "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground bg-transparent",
          collapsed
            ? "h-9 w-9 justify-center px-0 py-0 gap-0"
            : "w-full justify-start gap-2.5 px-3 py-1.5 text-sm font-medium",
        )}
      >
      <LogoutIcon ref={logoutRef} className="h-5 w-5 shrink-0" />
      {!collapsed && (
        <span
          className="overflow-hidden whitespace-nowrap text-sm font-medium transition-[max-width,opacity,transform] duration-200 ease-in-out max-w-[140px] opacity-100 translate-x-0"
        >
          Logout
        </span>
      )}
    </Button>
  );

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-[linear-gradient(to_bottom,transparent_48px,hsl(var(--sidebar))_48px)]">
      {/* Logo Section */}
      <div
        className={cn(
          "flex h-12 items-center transition-all duration-200 ease-in-out",
          collapsed ? "justify-center px-2" : "gap-3 px-3",
        )}
      >
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 m-auto hidden h-10 w-10 rounded-full bg-white dark:block"
            />
            <Image
              src="/images/psut-logo.png"
              alt="PSUT Logo"
              width={36}
              height={36}
              className="relative z-10 h-9 w-9 object-contain dark:translate-x-[2px]"
            />
          </div>
          <div
            className={cn(
              "flex flex-col min-w-0 overflow-hidden transition-[max-height,opacity,transform] duration-200 ease-in-out",
              collapsed ? "max-h-0 opacity-0 -translate-x-1" : "max-h-20 opacity-100 translate-x-0",
            )}
          >
              <span className="text-base font-bold text-slate-900 dark:text-white">
                PSUT
              </span>
              <span className="text-xs text-slate-700 dark:text-white/80 truncate">
                Timetabling System
              </span>
          </div>
        </div>

        {/* Navigation */}
        <Suspense fallback={<div className="flex-1" />}>
          <SidebarNavigation collapsed={collapsed} onNavigate={handleNavigate} />
        </Suspense>

        {/* Bottom Navigation */}
        <div
          className={cn(
            "space-y-1 border-t border-sidebar-border py-2 transition-all duration-200 ease-in-out",
            collapsed ? "flex flex-col items-center px-0" : "px-3",
          )}
        >
          {showAdminNav && (
            <NavButton
              href={accessRequestsNavItem.href}
              icon={accessRequestsNavItem.icon}
              title={accessRequestsNavItem.title}
              isActive={pathname === accessRequestsNavItem.href}
              collapsed={collapsed}
              onClick={handleNavigate}
              animated={accessRequestsNavItem.animated}
            />
          )}
          {showAdminNav && (
            <NavButton
              href={helpNavItem.href}
              icon={helpNavItem.icon}
              title={helpNavItem.title}
              isActive={pathname === helpNavItem.href}
              collapsed={collapsed}
              onClick={handleNavigate}
              animated={helpNavItem.animated}
              iconSize={helpNavItem.iconSize}
            iconClassName={helpNavItem.iconClassName}
            />
          )}
          <NavButton
            href={settingsNavItem.href}
            icon={settingsNavItem.icon}
            title={settingsNavItem.title}
            isActive={pathname === settingsNavItem.href}
            collapsed={collapsed}
            onClick={handleNavigate}
            animated={settingsNavItem.animated}
          />
          {/* Logout */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>{logoutButton}</TooltipTrigger>
              <TooltipContent side="right">Logout</TooltipContent>
            </Tooltip>
          ) : (
            logoutButton
          )}
        </div>

        {/* Collapse toggle (separated; always last) */}
        <div
          className={cn(
            "border-t border-sidebar-border py-1.5 transition-all duration-200 ease-in-out",
            collapsed ? "flex justify-center" : "flex justify-end px-3",
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                onClick={toggle}
              >
                <span className="relative inline-block h-4 w-4">
                  <PanelLeftOpen
                    className={cn(
                      "absolute inset-0 h-4 w-4 transition-opacity duration-200",
                      collapsed ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <PanelLeftClose
                    className={cn(
                      "absolute inset-0 h-4 w-4 transition-opacity duration-200",
                      collapsed ? "opacity-0" : "opacity-100",
                    )}
                  />
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
  );
}

export function Sidebar() {
  const { collapsed } = useSidebar();
  const [transitionsEnabled, setTransitionsEnabled] = useState(false);

  useEffect(() => {
    setTransitionsEnabled(true);
  }, []);

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 hidden h-12 border-b border-sidebar-border bg-[url('/images/background/D66.png')] bg-top bg-repeat-x bg-[length:auto_48px] dark:bg-[image:linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)),url('/images/background/D66.png')] lg:block" />
      <aside
        className={cn(
          "relative z-10 hidden min-w-0 shrink-0 overflow-hidden lg:block",
          transitionsEnabled && "transition-all duration-300 ease-in-out",
          collapsed ? "w-12 min-w-12 max-w-12" : "w-56 min-w-56 max-w-56",
        )}
      >
        <div className="pointer-events-none absolute bottom-0 right-0 top-12 w-px bg-sidebar-border" />
        <SidebarContent />
      </aside>
    </>
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
  const { authLoading, showLecturerNav, showAdminNav } = useSidebarNavVisibility();
  const [entityOpen, setEntityOpen] = useState(() => isEntityManagementSectionActive(pathname));

  useEffect(() => {
    if (isEntityManagementSectionActive(pathname)) setEntityOpen(true);
  }, [pathname]);

  const handleLogout = async () => {
    onNavigate?.();
    await logout();
  };

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-12 items-center gap-3 border-b border-sidebar-border bg-[url('/images/background/D66.png')] bg-top bg-repeat-x bg-[length:auto_48px] dark:bg-[image:linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)),url('/images/background/D66.png')] px-5">
        <div className="relative flex h-9 w-9 items-center justify-center">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 m-auto hidden h-10 w-10 rounded-full bg-white dark:block"
          />
          <Image
            src="/images/psut-logo.png"
            alt="PSUT Logo"
            width={36}
            height={36}
            className="relative z-10 h-9 w-9 object-contain dark:translate-x-[2px]"
          />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold text-slate-900 dark:text-white">PSUT</span>
          <span className="text-xs text-slate-700 dark:text-white/80">Timetabling System</span>
        </div>
      </div>

      <ScrollArea className="flex-1 py-2">
        <div className="space-y-1 px-3">
          {authLoading && <SidebarNavSkeleton collapsed={false} />}

          {showAdminNav && mainNavItems.map((item) => (
            <NavButton
              key={item.href}
              href={item.href}
              icon={item.icon}
              title={item.title}
              isActive={pathname === item.href}
              collapsed={false}
              onClick={onNavigate}
              animated={item.animated}
              iconSize={item.iconSize}
              iconClassName={item.iconClassName}
            />
          ))}

          {showAdminNav && <div className="pt-0">
            <Collapsible open={entityOpen} onOpenChange={setEntityOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full min-w-0 justify-between gap-2 overflow-hidden rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
                    "border-0 outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none",
                    isEntityManagementSectionActive(pathname)
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground bg-transparent",
                  )}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <UsersRoundIcon size={20} className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 truncate text-left">Entity Management</span>
                  </span>
                  <ChevronDownIcon
                    size={16}
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      entityOpen && "rotate-180",
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pt-0">
                {entityNavItems.map((item) => (
                  <NavButton
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    title={item.title}
                    isActive={pathname === item.href}
                    collapsed={false}
                    onClick={onNavigate}
                    isSubItem
                    animated={item.animated}
                    iconSize={item.iconSize}
                    iconClassName={item.iconClassName}
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>}

          {showAdminNav && <div className="pt-0">
            {otherNavItems.map((item) => (
              <NavButton
                key={item.href}
                href={item.href}
                icon={item.icon}
                title={item.title}
                isActive={pathname === item.href}
                collapsed={false}
                onClick={onNavigate}
                animated={item.animated}
                iconSize={item.iconSize}
                iconClassName={item.iconClassName}
              />
            ))}
          </div>}

          {showLecturerNav && (
            <div className="pt-0">
              {lecturerNavItems.map((item) => (
                <NavButton
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  title={item.title}
                  isActive={pathname === item.href}
                  collapsed={false}
                  onClick={onNavigate}
                  animated={item.animated}
                  iconSize={item.iconSize}
                  iconClassName={item.iconClassName}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-sidebar-border space-y-1 px-3 py-2">
        {showAdminNav && (
          <NavButton
            href={accessRequestsNavItem.href}
            icon={accessRequestsNavItem.icon}
            title={accessRequestsNavItem.title}
            isActive={pathname === accessRequestsNavItem.href}
            collapsed={false}
            onClick={onNavigate}
            animated={accessRequestsNavItem.animated}
          />
        )}
        {showAdminNav && (
          <NavButton
            href={helpNavItem.href}
            icon={helpNavItem.icon}
            title={helpNavItem.title}
            isActive={pathname === helpNavItem.href}
            collapsed={false}
            onClick={onNavigate}
            animated={helpNavItem.animated}
            iconSize={helpNavItem.iconSize}
            iconClassName={helpNavItem.iconClassName}
          />
        )}
        <NavButton
          href={settingsNavItem.href}
          icon={settingsNavItem.icon}
          title={settingsNavItem.title}
          isActive={pathname === settingsNavItem.href}
          collapsed={false}
          onClick={onNavigate}
          animated={settingsNavItem.animated}
        />
        <Button
          variant="ghost"
          className="w-full justify-start gap-2.5 rounded-lg border-0 px-3 py-1.5 text-sm font-medium text-muted-foreground outline-none ring-0 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:ring-0 focus-visible:ring-0 focus-visible:outline-none bg-transparent"
          onClick={handleLogout}
        >
          <LogoutIcon className="h-5 w-5 shrink-0" />
          <span>Logout</span>
        </Button>
      </div>
    </div>
  );
}
