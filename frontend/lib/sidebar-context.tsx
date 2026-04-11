"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type SidebarContextType = {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
};

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  toggle: () => {},
  setCollapsed: () => {},
});

const SIDEBAR_COLLAPSED_STORAGE_KEY = "psut-sidebar-collapsed";
const SIDEBAR_COLLAPSED_COOKIE_KEY = "psut-sidebar-collapsed";
const SIDEBAR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function SidebarProvider({
  children,
  initialCollapsed = false,
}: {
  children: ReactNode;
  initialCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    // Keep first server and client render consistent to avoid hydration mismatch.
    return initialCollapsed;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SIDEBAR_COLLAPSED_STORAGE_KEY,
        collapsed ? "true" : "false",
      );
    } catch {
      // Ignore storage failures.
    }

    document.cookie = `${SIDEBAR_COLLAPSED_COOKIE_KEY}=${collapsed ? "true" : "false"}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE_SECONDS}`;
  }, [collapsed]);

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        toggle: () => setCollapsed((c) => !c),
        setCollapsed,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
