import { proxyToBackend } from '@/lib/proxy-backend';

export async function GET() {
  return proxyToBackend('/course-modification-requests/me/catalog', {
    method: 'GET',
  });
}
