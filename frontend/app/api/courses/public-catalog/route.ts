import { proxyToBackend } from '@/lib/proxy-backend';

export async function GET() {
  return proxyToBackend('/courses/public/catalog', { method: 'GET' });
}
