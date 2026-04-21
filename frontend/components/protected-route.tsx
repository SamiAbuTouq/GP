"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2, ShieldOff } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: ReactNode;
  /** Roles that are allowed to render this content. Defaults to ["ADMIN"]. */
  allowedRoles?: string[];
}

/**
 * ProtectedRoute — client-side authorization guard.
 *
 * Layers of defense:
 *  1. Next.js middleware (server-side, first line)
 *  2. AuthProvider route-effect (client-side redirect)
 *  3. This component — renders nothing / access-denied UI as final guard
 */
export function ProtectedRoute({
  children,
  allowedRoles = ["ADMIN"],
}: ProtectedRouteProps) {
  const { user, authLoading } = useAuth();
  const router = useRouter();

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  // Loading state
  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2
          className="h-8 w-8 animate-spin text-muted-foreground"
          aria-label="Loading"
        />
      </div>
    );
  }

  // Not authenticated — render nothing while redirect fires
  if (!user) {
    return null;
  }

  // Role check
  const hasAccess = allowedRoles.includes(user.role);
  if (!hasAccess) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <ShieldOff className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          You don&apos;t have permission to view this page. Please contact your
          administrator if you believe this is a mistake.
        </p>
        <Button variant="outline" onClick={() => router.back()} className="mt-2">
          Go Back
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
