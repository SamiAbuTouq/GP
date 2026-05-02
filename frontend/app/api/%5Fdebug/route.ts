import { NextResponse } from "next/server";

type DebugPayload = {
  sessionId?: string;
  runId?: string;
  hypothesisId?: string;
  location?: string;
  message?: string;
  data?: unknown;
  timestamp?: number;
};

export async function POST(request: Request) {
  let payload: DebugPayload | null = null;
  try {
    payload = (await request.json()) as DebugPayload;
  } catch {
    // ignore
  }

  // Relay to the provisioned local ingest endpoint from the server runtime.
  // This avoids browser-to-localhost-port restrictions.
  try {
    await fetch("http://127.0.0.1:7709/ingest/ec09a340-7727-4b91-930d-cfdbd393ea72", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "d7b561",
      },
      body: JSON.stringify({
        sessionId: "d7b561",
        runId: payload?.runId ?? "initial",
        hypothesisId: payload?.hypothesisId ?? "relay",
        location: payload?.location ?? "frontend/app/api/%5Fdebug/route.ts",
        message: payload?.message ?? "relayed debug event",
        data: payload?.data ?? null,
        timestamp: typeof payload?.timestamp === "number" ? payload.timestamp : Date.now(),
      }),
    });
  } catch {
    // never break app behavior for logging
  }

  return new NextResponse(null, { status: 204 });
}

