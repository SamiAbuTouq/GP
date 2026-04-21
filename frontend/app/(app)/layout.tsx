"use client";

import { usePathname } from "next/navigation";
import { GwoRunProvider } from "@/components/gwo-run-context";
import { TimetableGridDraftProvider } from "@/components/timetable-grid-draft-context";
import { ProtectedRoute } from "@/components/protected-route";

const LECTURER_ONLY_PATHS = ["/lecturer-time-preferences", "/lecturer-schedule"];
const SHARED_PATHS = ["/settings"];

function matchesAny(pathname: string, paths: string[]): boolean {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Layout for all protected app pages.
 *
 * This enforces role-based access as the client-side third layer of defense
 * (after NestJS backend guards and Next.js middleware).
 *
 * - All routes in (app) require authentication.
 * - Settings (and its sub-routes) allow both ADMIN and LECTURER.
 * - Lecturer time preferences are LECTURER-only.
 * - All remaining routes are ADMIN-only.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const allowedRoles = matchesAny(pathname, LECTURER_ONLY_PATHS)
    ? ["LECTURER"]
    : matchesAny(pathname, SHARED_PATHS)
      ? ["ADMIN", "LECTURER"]
      : ["ADMIN"];

  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <GwoRunProvider>
        <TimetableGridDraftProvider>{children}</TimetableGridDraftProvider>
      </GwoRunProvider>
    </ProtectedRoute>
  );
}
