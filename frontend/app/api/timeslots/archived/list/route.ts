import { proxyToBackend } from '@/lib/proxy-backend'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter')
  const qs =
    filter && filter !== 'all'
      ? `?filter=${encodeURIComponent(filter)}`
      : ''
  return proxyToBackend(`/timeslots/archived/list${qs}`, { method: 'GET' })
}

