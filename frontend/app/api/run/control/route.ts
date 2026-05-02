import { NextResponse } from "next/server";
import { writeFileSync } from "fs";
import { getGwoControlFilePath } from "@/lib/gwo-control-path";
import { setGwoRunPaused } from "@/lib/gwo-server-run-lock";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { action?: string };
    const action = body?.action;
    const controlFile = getGwoControlFilePath();

    if (action === "pause") {
      writeFileSync(controlFile, "pause", "utf8");
      setGwoRunPaused(true);
      return NextResponse.json({ ok: true });
    }
    if (action === "resume") {
      writeFileSync(controlFile, "run", "utf8");
      setGwoRunPaused(false);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { ok: false, error: "Invalid action (use pause or resume)" },
      { status: 400 },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }
}
