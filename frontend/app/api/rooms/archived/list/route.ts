import { proxyToBackend } from '@/lib/proxy-backend'

export async function GET() {
  return proxyToBackend('/rooms/archived/list', { method: 'GET' })
}

