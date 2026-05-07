import { NextResponse } from 'next/server';
import { proxyToBackend } from '@/lib/proxy-backend';

export async function GET() {
  return proxyToBackend('/course-modification-requests/me', { method: 'GET' });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const payload = {
      addCourseIds: Array.isArray(body.addCourseIds)
        ? body.addCourseIds.map((v) => Number(v))
        : [],
      removeCourseIds: Array.isArray(body.removeCourseIds)
        ? body.removeCourseIds.map((v) => Number(v))
        : [],
      note: String(body.note ?? '').trim() || undefined,
    };
    return proxyToBackend('/course-modification-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
}
