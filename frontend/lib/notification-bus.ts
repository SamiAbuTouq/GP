export const NOTIFICATIONS_REFRESH_EVENT = "uts-notifications-refresh";

export type NotificationsRefreshDetail = {
  /** When set, the header bell applies this unread count immediately (before refetch). */
  unreadCount?: number;
};

export function dispatchNotificationsRefresh(detail?: NotificationsRefreshDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<NotificationsRefreshDetail>(NOTIFICATIONS_REFRESH_EVENT, {
      detail: detail ?? {},
    }),
  );
}

export function onNotificationsRefresh(
  handler: (detail: NotificationsRefreshDetail) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const fn = (e: Event) => {
    const d = (e as CustomEvent<NotificationsRefreshDetail>).detail ?? {};
    handler(d);
  };
  window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, fn);
  return () => window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, fn);
}
