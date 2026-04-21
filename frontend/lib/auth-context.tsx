"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { ApiClient } from "./api-client";

interface User {
  id: number;
  email: string;
  role: string;
  requiresPasswordChange: boolean;
}

interface AuthContextType {
  user: User | null;
  /** True until the initial session restore (refresh token) finishes */
  authLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Routes that don't require authentication
const publicRoutes = ["/", "/login", "/forgot-password", "/reset-password", "/help"];
const SETTINGS_ROUTE = "/settings";
const LECTURER_TIME_PREFERENCES_ROUTE = "/lecturer-time-preferences";
const LECTURER_SCHEDULE_ROUTE = "/lecturer-schedule";
const LECTURER_ROLE = "LECTURER";

export function isAuthPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function isAllowedLecturerPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/first-login-password") return true;
  return (
    pathname === SETTINGS_ROUTE ||
    pathname.startsWith(`${SETTINGS_ROUTE}/`) ||
    pathname === LECTURER_TIME_PREFERENCES_ROUTE ||
    pathname.startsWith(`${LECTURER_TIME_PREFERENCES_ROUTE}/`) ||
    pathname === LECTURER_SCHEDULE_ROUTE ||
    pathname.startsWith(`${LECTURER_SCHEDULE_ROUTE}/`)
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const themeSynced = useRef(false);

  // Sync user theme preference from backend when user logs in
  useEffect(() => {
    if (!user?.id) {
      themeSynced.current = false;
      return;
    }

    if (!themeSynced.current) {
      ApiClient.getProfile().then(profile => {
        if (profile.theme_preference) {
          setTheme(profile.theme_preference);
          themeSynced.current = true;
        }
      }).catch(() => {
        // Silently fail if profile can't be loaded
      });
    }
  }, [user?.id]);

  /**
   * Decode JWT to extract user info
   * Note: This is just for UI purposes - actual validation happens on backend
   */
  const decodeToken = useCallback((token: string): User | null => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const id =
        typeof payload.sub === "number"
          ? payload.sub
          : parseInt(String(payload.sub), 10);
      if (!Number.isFinite(id) || id < 1) return null;
      return {
        id,
        email: payload.email,
        role: payload.role,
        requiresPasswordChange: Boolean(payload.requires_password_change),
      };
    } catch {
      return null;
    }
  }, []);

  /**
   * Try to restore session on page load using refresh token cookie
   * This is called once on mount to restore auth state
   */
  const restoreSession = useCallback(async (): Promise<boolean> => {
    try {
      // Try to get a new access token using the HttpOnly refresh token cookie
      const response = await ApiClient.refresh();
      const decodedUser = decodeToken(response.access_token);
      
      if (decodedUser) {
        setUser(decodedUser);
        return true;
      }
      
      setUser(null);
      return false;
    } catch {
      // No valid refresh token or server error - user needs to login
      setUser(null);
      return false;
    }
  }, [decodeToken]);

  /**
   * Refresh auth state - can be called manually
   */
  const refreshAuth = useCallback(async (): Promise<boolean> => {
    const result = await restoreSession();
    setAuthLoading(false);
    return result;
  }, [restoreSession]);

  /**
   * Login function that handles the full login flow
   */
  const login = useCallback(async (email: string, password: string) => {
    const response = await ApiClient.login(email, password);
    const decodedUser = decodeToken(response.access_token);
    
    if (decodedUser) {
      setUser(decodedUser);
    }
    
    setAuthLoading(false);
    if (response.requires_password_change) {
      router.push("/first-login-password");
      return;
    }
    if (decodedUser?.role === LECTURER_ROLE) {
      router.push(LECTURER_TIME_PREFERENCES_ROUTE);
      return;
    }

    router.push("/dashboard");
  }, [decodeToken, router]);

  /**
   * Logout function - clears session and redirects to login
   */
  const logout = useCallback(async () => {
    try {
      await ApiClient.logout();
    } catch {
      // Even if API fails, clear local state
    } finally {
      setUser(null);
      router.push("/login");
    }
  }, [router]);

  // Subscribe to token changes from ApiClient
  useEffect(() => {
    const unsubscribe = ApiClient.onTokenChange((token) => {
      if (token) {
        const decodedUser = decodeToken(token);
        setUser(decodedUser);
      } else {
        setUser(null);
      }
    });

    return unsubscribe;
  }, [decodeToken]);

  // Initial session restoration on mount
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        await restoreSession();
      } catch {
        // Session restoration failed, that's ok
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      mounted = false;
    };
  }, []); // Only run on mount

  // Handle route protection after auth state is determined
  useEffect(() => {
    if (!authLoading) {
      const isPublicRoute = isAuthPublicPath(pathname);

      if (!user && !isPublicRoute) {
        // Not authenticated and trying to access protected route
        router.replace("/login");
      } else if (
        user?.requiresPasswordChange &&
        pathname !== "/first-login-password"
      ) {
        router.replace("/first-login-password");
      } else if (
        user?.role === LECTURER_ROLE &&
        !isAllowedLecturerPath(pathname)
      ) {
        router.replace(LECTURER_TIME_PREFERENCES_ROUTE);
      } else if (user && pathname === "/login") {
        // Authenticated users should not stay on login page.
        if (user.requiresPasswordChange) {
          router.replace("/first-login-password");
        } else if (user.role === LECTURER_ROLE) {
          router.replace(LECTURER_TIME_PREFERENCES_ROUTE);
        } else {
          router.replace("/dashboard");
        }
      }
    }
  }, [user, authLoading, pathname, router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        authLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
