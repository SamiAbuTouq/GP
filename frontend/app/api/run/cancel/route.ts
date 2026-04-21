import { NextResponse } from "next/server";
import { abortActiveGwoRun } from "@/lib/gwo-server-run-lock";

export const runtime = "nodejs";

export async function POST() {
  const stopped = abortActiveGwoRun();
  return NextResponse.json({ ok: true, stopped });
}
