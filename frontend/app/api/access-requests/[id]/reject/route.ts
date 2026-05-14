import { NextResponse } from 'next/server';
import { forwardedAuthorizationHeaders, proxyToBackend } from '@/lib/proxy-backend';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    return proxyToBackend(`/access-requests/${encodeURIComponent(id)}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason: String(body.reason ?? '').trim() || undefined }),
      headers: forwardedAuthorizationHeaders(request),
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
}
