"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow, isThisYear, isToday, isYesterday } from "date-fns";
import { BellOff, MoreHorizontal, Trash2 } from "lucide-react";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApiClient, ApiError, type AppNotificationRow } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { dispatchNotificationsRefresh, onNotificationsRefresh } from "@/lib/notification-bus";
import { getNotificationHref, stripNotificationMachineTags } from "@/lib/notification-navigation";
import { useToast } from "@/hooks/use-toast";

type FilterTab = "all" | "unread" | "read";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 7 * 24 * 60 * 60 * 1000) return formatDistanceToNow(d, { addSuffix: true });
  if (isToday(d)) return `Today, ${format(d, "p")}`;
  if (isYesterday(d)) return `Yesterday, ${format(d, "p")}`;
  if (isThisYear(d)) return format(d, "d MMM yyyy, p");
  return format(d, "d MMM yyyy, p");
}

export default function NotificationsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [items, setItems] = useState<AppNotificationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [listEpoch, setListEpoch] = useState(0);
  /** Full-page skeletons only on first load; tab changes use `refreshing` instead to avoid flash. */
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const hasLoadedOnce = useRef(false);
  const fetchGeneration = useRef(0);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const pageSize = 15;

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    const generation = ++fetchGeneration.current;
    const isFirstFullLoad = !hasLoadedOnce.current;
    if (page > 1) {
      setLoadingMore(true);
    } else if (isFirstFullLoad) {
      setLoading(true);
    } else if (!silent) {
      setRefreshing(true);
    }
    try {
      const res = await ApiClient.getNotifications({
        filter: filter === "all" ? "all" : filter,
        page,
        pageSize,
      });
      if (generation !== fetchGeneration.current) return;
      setTotal(res.total);
      if (page <= 1) {
        setItems(res.items);
      } else {
        setItems((prev) => {
          const seen = new Set(prev.map((p) => p.notificationId));
          const next = res.items.filter((i) => !seen.has(i.notificationId));
          return [...prev, ...next];
        });
      }
    } catch (e) {
      if (generation !== fetchGeneration.current) return;
      if (e instanceof ApiError && e.errorType === "UNAUTHORIZED") {
        setItems([]);
        setTotal(0);
      } else if (page <= 1) {
        setItems([]);
        setTotal(0);
      }
    } finally {
      if (generation === fetchGeneration.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        hasLoadedOnce.current = true;
      }
    }
  }, [filter, page, pageSize, listEpoch]);

  const refreshUnreadCount = useCallback(async (): Promise<number | null> => {
    try {
      const { count } = await ApiClient.getNotificationsUnreadCount();
      setUnreadTotal(count);
      return count;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    void load();
    void refreshUnreadCount();
  }, [load, refreshUnreadCount]);

  useEffect(() => {
    return onNotificationsRefresh(() => {
      void load({ silent: true });
      void refreshUnreadCount();
    });
  }, [load, refreshUnreadCount]);


  const markAllRead = async () => {
    const prev = items;
    setItems((rows) => rows.map((r) => ({ ...r, isRead: true })));
    setUnreadTotal(0);
    dispatchNotificationsRefresh({ unreadCount: 0 });
    try {
      await ApiClient.markAllNotificationsRead();
      setPage(1);
      setListEpoch((e) => e + 1);
      const c = await refreshUnreadCount();
      if (c !== null) {
        dispatchNotificationsRefresh({ unreadCount: c });
      }
    } catch {
      setItems(prev);
      const c = await refreshUnreadCount();
      if (c !== null) {
        dispatchNotificationsRefresh({ unreadCount: c });
      }
    }
  };

  const onCardClick = async (n: AppNotificationRow) => {
    const href = getNotificationHref(n.messageTitle, {
      role: user?.role ?? undefined,
      message: n.message,
    });
    if (!n.isRead) {
      const nextUnread = Math.max(0, unreadTotal - 1);
      setItems((rows) =>
        rows.map((r) => (r.notificationId === n.notificationId ? { ...r, isRead: true } : r)),
      );
      setUnreadTotal(nextUnread);
      dispatchNotificationsRefresh({ unreadCount: nextUnread });
      try {
        await ApiClient.markNotificationRead(n.notificationId);
        const c = await refreshUnreadCount();
        if (c !== null) {
          dispatchNotificationsRefresh({ unreadCount: c });
        }
      } catch {
        setItems((rows) =>
          rows.map((r) => (r.notificationId === n.notificationId ? { ...r, isRead: false } : r)),
        );
        void refreshUnreadCount().then((c) => {
          if (c !== null) {
            dispatchNotificationsRefresh({ unreadCount: c });
          }
        });
        return;
      }
    }
    if (href) router.push(href);
  };

  const markUnreadOne = async (e: React.MouseEvent, n: AppNotificationRow) => {
    e.stopPropagation();
    if (!n.isRead) return;
    const nextUnread = unreadTotal + 1;
    setItems((rows) =>
      rows.map((r) => (r.notificationId === n.notificationId ? { ...r, isRead: false } : r)),
    );
    setUnreadTotal(nextUnread);
    dispatchNotificationsRefresh({ unreadCount: nextUnread });
    try {
      await ApiClient.markNotificationUnread(n.notificationId);
      const c = await refreshUnreadCount();
      if (c !== null) {
        dispatchNotificationsRefresh({ unreadCount: c });
      }
    } catch {
      setItems((rows) =>
        rows.map((r) => (r.notificationId === n.notificationId ? { ...r, isRead: true } : r)),
      );
      void refreshUnreadCount().then((co) => {
        if (co !== null) {
          dispatchNotificationsRefresh({ unreadCount: co });
        }
      });
    }
  };

  const deleteNotification = async (e: React.MouseEvent, n: AppNotificationRow) => {
    e.stopPropagation();
    const snapshotItems = items;
    const snapshotTotal = total;
    const snapshotUnread = unreadTotal;
    const nextUnread = !n.isRead ? Math.max(0, unreadTotal - 1) : unreadTotal;
    setItems((rows) => rows.filter((r) => r.notificationId !== n.notificationId));
    setTotal((t) => Math.max(0, t - 1));
    if (!n.isRead) {
      setUnreadTotal(nextUnread);
    }
    dispatchNotificationsRefresh({ unreadCount: nextUnread });
    try {
      await ApiClient.deleteNotification(n.notificationId);
      const c = await refreshUnreadCount();
      if (c !== null) {
        dispatchNotificationsRefresh({ unreadCount: c });
      }
    } catch {
      setItems(snapshotItems);
      setTotal(snapshotTotal);
      setUnreadTotal(snapshotUnread);
      dispatchNotificationsRefresh({ unreadCount: snapshotUnread });
      toast({
        title: "Could not delete notification",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const showMarkAll = unreadTotal > 0;

  const emptyAll = !loading && !refreshing && total === 0 && filter === "all";
  const emptyUnread = !loading && !refreshing && total === 0 && filter === "unread";
  const emptyRead = !loading && !refreshing && total === 0 && filter === "read";

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="mx-auto w-full max-w-3xl space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Notifications</h1>
                <p className="text-sm text-muted-foreground">Updates from timetabling, publishing, and your account.</p>
              </div>
              {showMarkAll ? (
                <Button variant="outline" size="sm" className="shrink-0 self-start sm:self-auto" onClick={() => void markAllRead()}>
                  Mark all as read
                </Button>
              ) : null}
            </div>

            <Tabs
              value={filter}
              onValueChange={(v) => {
                setFilter(v as FilterTab);
                setPage(1);
                setItems([]);
                setTotal(0);
                if (hasLoadedOnce.current) {
                  setRefreshing(true);
                }
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-flex">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="unread">Unread</TabsTrigger>
                <TabsTrigger value="read">Read</TabsTrigger>
              </TabsList>
            </Tabs>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            ) : emptyAll ? (
              <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-16 text-center">
                <BellOff className="h-10 w-10 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium text-foreground">You&apos;re all caught up.</p>
                <p className="max-w-sm text-xs text-muted-foreground">When something needs your attention, it will appear here.</p>
              </Card>
            ) : emptyUnread || emptyRead ? (
              <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-16 text-center">
                <BellOff className="h-10 w-10 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium text-foreground">
                  {emptyUnread ? "No unread notifications." : "No read notifications to show."}
                </p>
              </Card>
            ) : (
              <>
                <ul className="space-y-2">
                  {items.map((n) => (
                    <li key={n.notificationId}>
                      <Card
                        role="button"
                        tabIndex={0}
                        onClick={() => void onCardClick(n)}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter" || ev.key === " ") {
                            ev.preventDefault();
                            void onCardClick(n);
                          }
                        }}
                        className={cn(
                          "relative cursor-pointer border p-4 pr-12 transition-colors hover:bg-muted/40",
                          !n.isRead && "border-l-4 border-l-primary bg-primary/[0.04]",
                        )}
                      >
                        <div className="flex flex-col gap-1">
                          <h2 className={cn("text-sm", !n.isRead ? "font-bold" : "font-semibold")}>{n.messageTitle}</h2>
                          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                            {stripNotificationMachineTags(n.message)}
                          </p>
                          <p className="text-xs text-muted-foreground">{formatWhen(n.createdAt)}</p>
                        </div>
                        <div className="absolute right-2 top-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Notification actions">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              {n.isRead ? (
                                <DropdownMenuItem onClick={(e) => void markUnreadOne(e, n)}>Mark as unread</DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const nextUnread = Math.max(0, unreadTotal - 1);
                                    setItems((rows) =>
                                      rows.map((r) =>
                                        r.notificationId === n.notificationId ? { ...r, isRead: true } : r,
                                      ),
                                    );
                                    setUnreadTotal(nextUnread);
                                    dispatchNotificationsRefresh({ unreadCount: nextUnread });
                                    try {
                                      await ApiClient.markNotificationRead(n.notificationId);
                                      const c = await refreshUnreadCount();
                                      if (c !== null) {
                                        dispatchNotificationsRefresh({ unreadCount: c });
                                      }
                                    } catch {
                                      setItems((rows) =>
                                        rows.map((r) =>
                                          r.notificationId === n.notificationId ? { ...r, isRead: false } : r,
                                        ),
                                      );
                                      void refreshUnreadCount().then((co) => {
                                        if (co !== null) {
                                          dispatchNotificationsRefresh({ unreadCount: co });
                                        }
                                      });
                                    }
                                  }}
                                >
                                  Mark as read
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                className="gap-2"
                                onClick={(e) => void deleteNotification(e, n)}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
                {items.length < total ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={loadingMore}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
