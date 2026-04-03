"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ApiClient } from "./api-client";

interface User {
  id: number;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Routes that don't require authentication
const publicRoutes = ["/", "/login", "/forgot-password", "/reset-password", "/help"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  /**
   * Decode JWT to extract user info
   * Note: This is just for UI purposes - actual validation happens on backend
   */
  const decodeToken = useCallback((token: string): User | null => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
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
    setIsLoading(false);
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
    
    setIsLoading(false);
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
      // Check if we're on a public route - if so, still try to restore but don't block
      const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
      
      try {
        await restoreSession();
      } catch {
        // Session restoration failed, that's ok
      } finally {
        if (mounted) {
          setIsLoading(false);
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
    if (!isLoading) {
      const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route + "/"));
      
      if (!user && !isPublicRoute) {
        // Not authenticated and trying to access protected route
        router.push("/login");
      } else if (user && (pathname === "/login" || pathname === "/")) {
        // Authenticated but on login page or root
        router.push("/dashboard");
      }
    }
  }, [user, isLoading, pathname, router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
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
