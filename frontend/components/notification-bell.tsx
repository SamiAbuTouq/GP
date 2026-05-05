"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow, isThisYear, isToday, isYesterday } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ApiClient, ApiError, type AppNotificationRow } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Bell } from "@/components/animate-ui/icons/bell";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { onNotificationsRefresh } from "@/lib/notification-bus";
import { getNotificationHref, stripNotificationMachineTags } from "@/lib/notification-navigation";
import Link from "next/link";

/** While the tab is visible, poll at a steady interval (SSE refresh also bumps the bell after local actions). */
const POLL_MS_WHEN_VISIBLE = 5_000;
/** When the tab is in the background, back off to limit server load. */
const POLL_MS_WHEN_HIDDEN = 90_000;
/** Avoid duplicate refetches when both focus and visibility fire together. */
const FOCUS_REFETCH_THROTTLE_MS = 2_000;
const PREVIEW = 5;
const BELL_RING_MS = 1000;

function formatUnreadBadgeLabel(count: number): string {
  if (count <= 0) return "";
  if (count >= 9) return "9+";
  return String(count);
}

function truncateMessage(text: string, max = 90): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function formatNotificationTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = Date.now();
  if (now - d.getTime() < 60_000) return "just now";
  if (now - d.getTime() < 36 * 60 * 60 * 1000) {
    return formatDistanceToNow(d, { addSuffix: true });
  }
  if (isToday(d)) return `Today, ${format(d, "p")}`;
  if (isYesterday(d)) return `Yesterday, ${format(d, "p")}`;
  if (isThisYear(d)) return format(d, "d MMM, p");
  return format(d, "d MMM yyyy, p");
}

export function NotificationBell() {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  /** Last count seen from a poll / authoritative sync — null until first successful fetch. */
  const pollBaselineRef = useRef<number | null>(null);
  /** One-shot ring: same motion as hover (`default` animation on Bell icon). */
  const [bellRing, setBellRing] = useState(false);
  const bellRingClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Bumps when the badge should replay its enter pop (new unread from poll). */
  const [badgePopNonce, setBadgePopNonce] = useState(0);

  const ringBellOnce = useCallback(() => {
    if (bellRingClearTimerRef.current) {
      clearTimeout(bellRingClearTimerRef.current);
      bellRingClearTimerRef.current = null;
    }
    setBellRing(false);
    requestAnimationFrame(() => {
      setBellRing(true);
      bellRingClearTimerRef.current = setTimeout(() => {
        setBellRing(false);
        bellRingClearTimerRef.current = null;
      }, BELL_RING_MS);
    });
  }, []);

  const loadCount = useCallback(async () => {
    if (!user) return;
    try {
      const { count } = await ApiClient.getNotificationsUnreadCount();
      const baseline = pollBaselineRef.current;
      if (baseline !== null && count > baseline) {
        ringBellOnce();
        setBadgePopNonce((n) => n + 1);
      }
      pollBaselineRef.current = count;
      setUnread(count);
    } catch (e) {
      if (e instanceof ApiError && e.errorType === "UNAUTHORIZED") return;
    }
  }, [user, ringBellOnce]);

  const loadPreview = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await ApiClient.getNotifications({ page: 1, pageSize: PREVIEW });
      setItems(res.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const lastFocusRefetchAt = useRef(0);

  useEffect(() => {
    if (!user) return;
    void loadCount();

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const clearTimer = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const nextDelay = () =>
      document.visibilityState === "visible" ? POLL_MS_WHEN_VISIBLE : POLL_MS_WHEN_HIDDEN;

    const scheduleNext = () => {
      clearTimer();
      timeoutId = setTimeout(() => {
        void loadCount().finally(() => {
          scheduleNext();
        });
      }, nextDelay());
    };

    scheduleNext();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadCount();
      }
      clearTimer();
      scheduleNext();
    };

    const onFocus = () => {
      const now = Date.now();
      if (now - lastFocusRefetchAt.current < FOCUS_REFETCH_THROTTLE_MS) return;
      lastFocusRefetchAt.current = now;
      void loadCount();
    };

    const onOnline = () => {
      void loadCount();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    return () => {
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      if (bellRingClearTimerRef.current) {
        clearTimeout(bellRingClearTimerRef.current);
        bellRingClearTimerRef.current = null;
      }
    };
  }, [user, loadCount]);

  useEffect(() => {
    return onNotificationsRefresh((detail) => {
      if (
        typeof detail.unreadCount === "number" &&
        Number.isFinite(detail.unreadCount)
      ) {
        const c = Math.max(0, Math.floor(detail.unreadCount));
        pollBaselineRef.current = c;
        setUnread(c);
      }
      void loadCount();
      void loadPreview();
    });
  }, [loadCount, loadPreview]);

  useEffect(() => {
    if (open) void loadPreview();
  }, [open, loadPreview]);

  const markAllRead = async () => {
    const prev = unread;
    const prevItems = items;
    setUnread(0);
    setItems((rows) => rows.map((r) => ({ ...r, isRead: true })));
    pollBaselineRef.current = 0;
    try {
      await ApiClient.markAllNotificationsRead();
    } catch {
      setUnread(prev);
      setItems(prevItems);
      pollBaselineRef.current = prev;
    }
  };

  const onItemClick = async (n: AppNotificationRow) => {
    const href = getNotificationHref(n.messageTitle, {
      role: user?.role ?? undefined,
      message: n.message,
    });
    if (!n.isRead) {
      setItems((rows) =>
        rows.map((r) => (r.notificationId === n.notificationId ? { ...r, isRead: true } : r)),
      );
      setUnread((c) => {
        const next = Math.max(0, c - 1);
        pollBaselineRef.current = next;
        return next;
      });
      void ApiClient.markNotificationRead(n.notificationId).catch(() => {
        setItems((rows) =>
          rows.map((r) => (r.notificationId === n.notificationId ? { ...r, isRead: false } : r)),
        );
        setUnread((c) => {
          const next = c + 1;
          pollBaselineRef.current = next;
          return next;
        });
      });
    }
    setOpen(false);
    if (href) router.push(href);
  };

  if (!user) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full text-slate-700 hover:bg-slate-900/10 hover:text-slate-900 dark:text-white/90 dark:hover:bg-white/15 dark:hover:text-white"
        >
          <AnimateIcon animate={bellRing} animateOnHover>
            <Bell className="h-4 w-4" />
          </AnimateIcon>
          {unread > 0 ? (
            <Badge
              key={`${formatUnreadBadgeLabel(unread)}-${badgePopNonce}`}
              className={cn(
                "absolute -right-0.5 -top-0.5 flex h-5 min-w-5 px-1 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-[10px] font-semibold tabular-nums text-white shadow-sm dark:border-card dark:bg-neutral-200 dark:text-black",
                "origin-center animate-in zoom-in-95 fade-in duration-200",
              )}
            >
              {formatUnreadBadgeLabel(unread)}
            </Badge>
          ) : null}
          <span className="sr-only">View notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(
          "flex w-[min(100vw-1.5rem,22rem)] flex-col gap-0 overflow-hidden p-0",
          "max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))]",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-popover px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 ? (
            <Button variant="ghost" size="sm" className="h-8 shrink-0 px-2 text-xs" onClick={() => void markAllRead()}>
              Mark all as read
            </Button>
          ) : null}
        </div>
        <div className="max-h-[min(18rem,calc(var(--radix-dropdown-menu-content-available-height)-5.5rem))] overflow-y-auto overscroll-contain">
          {loading ? (
            <div className="space-y-2 p-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-md bg-muted/60" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <ul className="py-1">
              {items.map((n) => (
                <li key={n.notificationId}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/80",
                      !n.isRead && "bg-primary/5",
                    )}
                    onClick={() => void onItemClick(n)}
                  >
                    <span className="flex items-start gap-2">
                      {!n.isRead ? (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                      ) : (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-transparent" aria-hidden />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className={cn("line-clamp-2", !n.isRead ? "font-semibold text-foreground" : "font-medium")}>
                          {n.messageTitle}
                        </span>
                        <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {truncateMessage(stripNotificationMachineTags(n.message))}
                        </span>
                        <span className="mt-1 text-[11px] text-muted-foreground">
                          {formatNotificationTime(n.createdAt)}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="relative z-10 shrink-0 border-t border-border bg-popover px-2 py-2">
          <Button variant="ghost" size="sm" className="h-8 w-full justify-center text-xs" asChild>
            <Link href="/notifications" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
