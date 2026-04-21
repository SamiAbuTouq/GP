import { proxyToBackend } from '@/lib/proxy-backend'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  return proxyToBackend(`/timeslots/lecturer/preferences/${encodeURIComponent(userId)}`, { method: 'GET' })
}
