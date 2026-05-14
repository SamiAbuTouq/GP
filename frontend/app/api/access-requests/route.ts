import { NextResponse } from 'next/server';
import { forwardedAuthorizationHeaders, proxyToBackend } from '@/lib/proxy-backend';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
  return proxyToBackend(`/access-requests${suffix}`, {
    method: 'GET',
    headers: forwardedAuthorizationHeaders(request),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const payload = {
      fullName: String(body.fullName ?? '').trim(),
      email: String(body.email ?? '').trim().toLowerCase(),
      department: String(body.department ?? '').trim(),
      maxWorkload: Number(body.maxWorkload),
      courses: Array.isArray(body.courses) ? body.courses : [],
    };
    return proxyToBackend('/access-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: forwardedAuthorizationHeaders(request),
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
}
