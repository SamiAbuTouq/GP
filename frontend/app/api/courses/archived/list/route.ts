import { proxyToBackend } from '@/lib/proxy-backend'

export async function GET() {
  return proxyToBackend('/courses/archived/list', { method: 'GET' })
}

