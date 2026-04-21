import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type AuthUser = {
  role?: string;
  sub?: number;
  exp?: number;
};

type RefreshResponse = {
  access_token: string;
};

function decodeJwtPayload(token: string): AuthUser | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = Buffer.from(padded, "base64").toString("utf8");

    return JSON.parse(json) as AuthUser;
  } catch {
    return null;
  }
}

/**
 * Exchangess the HttpOnly refresh-token cookie for a fresh access token via
 * the NestJS /auth/refresh endpoint, then decodes the payload.
 *
 * Returns the decoded payload on success, or null if not authenticated.
 * Exported so route handlers can derive the authenticated user identity.
 */
export async function resolveUserFromRefreshCookie(): Promise<AuthUser | null> {
  const refreshToken = (await cookies()).get("refresh_token")?.value;
  if (!refreshToken) return null;

  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
  const refreshUrl = `${baseUrl.replace(/\/+$/, "")}/auth/refresh`;

  let refreshRes: Response;
  try {
    refreshRes = await fetch(refreshUrl, {
      method: "POST",
      headers: {
        Cookie: `refresh_token=${refreshToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
  } catch {
    return null;
  }

  if (!refreshRes.ok) return null;

  let payload: RefreshResponse;
  try {
    payload = (await refreshRes.json()) as RefreshResponse;
  } catch {
    return null;
  }

  return decodeJwtPayload(payload.access_token);
}

// ─── Public helpers ────────────────────────────────────────────────────────

/**
 * Requires the caller to be authenticated with ADMIN role.
 * Use on Next.js Route Handlers that should only be accessible by admins.
 */
export async function requireAdminFromRefreshCookie(): Promise<
  { ok: true } | { ok: false; response: NextResponse }
> {
  const user = await resolveUserFromRefreshCookie();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  if (user.role !== "ADMIN") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    };
  }

  return { ok: true };
}

/**
 * Requires the caller to be authenticated (any role: ADMIN or LECTURER).
 * Use on Route Handlers that authenticated users of any role may access.
 */
export async function requireAuthFromRefreshCookie(): Promise<
  { ok: true; role: string } | { ok: false; response: NextResponse }
> {
  const user = await resolveUserFromRefreshCookie();

  if (!user || !user.role) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  return { ok: true, role: user.role };
}
