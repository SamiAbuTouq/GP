"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { MobileSidebar } from "@/components/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/lib/auth-context"
import { ApiClient, ApiError, UserProfile } from "@/lib/api-client"
import { Bell } from "@/components/animate-ui/icons/bell"
import { AnimateIcon } from "@/components/animate-ui/icons/icon"

export function Header() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(() => ApiClient.getCachedProfile())

  useEffect(() => {
    let mounted = true;
    if (user) {
      ApiClient.getProfile()
        .then((data) => {
          if (mounted) setProfile(data);
        })
        .catch((err) => {
          // Session-expiry 401 is expected during auth transitions; avoid noisy console errors.
          if (err instanceof ApiError && err.errorType === "UNAUTHORIZED") {
            return;
          }
          console.error("Could not fetch profile in header", err);
        });
    }

    const unsubscribe = ApiClient.onProfileUpdate((updatedProfile) => {
      if (mounted) {
        setProfile((prev) => prev ? { ...prev, ...updatedProfile } : (updatedProfile as UserProfile));
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [user]);

  const handleLogout = async () => {
    await logout()
  }

  return (
    <header
      className="sticky top-0 z-50 flex h-12 items-center justify-between px-4 lg:px-6 bg-transparent"
    >
      <div className="flex items-center gap-3">
        <MobileSidebar />
        <Separator orientation="vertical" className="hidden h-6 bg-slate-600/35 dark:bg-white/35 md:block" />
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 rounded-full text-slate-700 hover:bg-slate-900/10 hover:text-slate-900 dark:text-white/90 dark:hover:bg-white/15 dark:hover:text-white"
            >
              <AnimateIcon animateOnHover>
                <Bell className="h-4 w-4" />
              </AnimateIcon>
              <Badge className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-[10px] text-white dark:border-card dark:bg-neutral-200 dark:text-black">
                3
              </Badge>
              <span className="sr-only">View notifications</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex flex-col items-start gap-1 cursor-pointer">
              <span className="font-medium">Timetable Generated</span>
              <span className="text-xs text-muted-foreground">Fall 2024 timetable ready for review</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 cursor-pointer">
              <span className="font-medium">Conflict Detected</span>
              <span className="text-xs text-muted-foreground">Room R202 double-booked on Monday</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 cursor-pointer">
              <span className="font-medium">New Course Added</span>
              <span className="text-xs text-muted-foreground">AI Ethics (CS450) added to catalog</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile Avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-10 w-10 rounded-full p-0 text-slate-700 hover:bg-slate-900/10 hover:text-slate-900 dark:text-white/90 dark:hover:bg-white/15 dark:hover:text-white"
            >
              <Avatar className="h-10 w-10 border-2 border-slate-600/20 dark:border-white/35">
                <AvatarImage src={profile?.avatar_url || undefined} alt="User" />
                <AvatarFallback
                  delayMs={700}
                  className="bg-slate-900 text-white font-semibold text-sm dark:bg-neutral-200 dark:text-black"
                >
                  {profile ? (
                    <>
                      {profile.first_name?.[0]}
                      {profile.last_name?.[0]}
                    </>
                  ) : (
                    "U"
                  )}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user?.role || "User"}</p>
                <p className="text-xs text-muted-foreground">{user?.email || "Not signed in"}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>Profile Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={handleLogout}>Sign Out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
