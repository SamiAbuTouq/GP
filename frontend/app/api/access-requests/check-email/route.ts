import { NextResponse } from 'next/server';
import { proxyToBackend } from '@/lib/proxy-backend';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  if (!email) {
    return NextResponse.json({ error: 'email query parameter is required.' }, { status: 400 });
  }
  return proxyToBackend(`/access-requests/check-email?email=${encodeURIComponent(email)}`, {
    method: 'GET',
  });
}
