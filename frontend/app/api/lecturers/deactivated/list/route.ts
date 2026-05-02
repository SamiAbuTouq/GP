import { proxyToBackend } from '@/lib/proxy-backend'

export async function GET() {
  return proxyToBackend('/lecturers/deactivated/list', { method: 'GET' })
}

