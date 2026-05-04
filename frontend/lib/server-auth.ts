import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
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

    const payload = JSON.parse(json) as Record<string, unknown>;
    const subRaw = payload.sub;
    const sub =
      typeof subRaw === "number" && Number.isFinite(subRaw)
        ? subRaw
        : typeof subRaw === "string" && Number.isFinite(Number(subRaw))
          ? Number(subRaw)
          : undefined;
    return {
      ...payload,
      role: typeof payload.role === "string" ? payload.role : undefined,
      sub,
      exp: typeof payload.exp === "number" ? payload.exp : undefined,
    } as AuthUser;
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

/**
 * When the SPA calls Nest on another origin (e.g. API on :3001), the refresh cookie is set for
 * that host and is not sent to Next (:3000). Route handlers can authenticate the same user via
 * the in-memory access token forwarded as `Authorization: Bearer …`.
 */
export function resolveUserFromAccessTokenBearer(authorization: string | null): AuthUser | null {
  if (!authorization || !authorization.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  if (!token) return null;
  const user = decodeJwtPayload(token);
  if (!user?.role) return null;
  if (typeof user.exp === "number" && Number.isFinite(user.exp) && Date.now() >= user.exp * 1000) {
    return null;
  }
  return user;
}

/** Prefer Bearer access token (cross-port dev); fall back to refresh cookie → Nest refresh. */
export async function resolveAuthUser(request?: NextRequest | Request): Promise<AuthUser | null> {
  const authorization = request?.headers.get("authorization") ?? null;
  const fromBearer = resolveUserFromAccessTokenBearer(authorization);
  if (fromBearer) return fromBearer;
  return await resolveUserFromRefreshCookie();
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

/** ADMIN only: Bearer token or refresh cookie (same as {@link requireAdminFromRefreshCookie} when no request). */
export async function requireAdminFromRefreshOrBearer(
  request: NextRequest | Request,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const user = await resolveAuthUser(request);

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

/** ADMIN or LECTURER: Bearer or refresh cookie (use when the client may call from Next origin only). */
export async function requireAuthFromRefreshOrBearer(
  request: NextRequest | Request,
): Promise<{ ok: true; role: string } | { ok: false; response: NextResponse }> {
  const user = await resolveAuthUser(request);

  if (!user || !user.role) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  return { ok: true, role: user.role };
}
