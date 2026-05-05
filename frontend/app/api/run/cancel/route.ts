import { NextResponse, type NextRequest } from "next/server";
import { abortActiveGwoRun } from "@/lib/gwo-server-run-lock";
import { requireAdminFromRefreshOrBearer } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireAdminFromRefreshOrBearer(request);
  if (!auth.ok) return auth.response;
  const stopped = abortActiveGwoRun();
  return NextResponse.json({ ok: true, stopped });
}
