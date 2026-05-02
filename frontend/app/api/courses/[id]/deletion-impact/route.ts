import { proxyToBackend } from '@/lib/proxy-backend'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return proxyToBackend(`/courses/${encodeURIComponent(id)}/deletion-impact`, {
    method: 'GET',
  })
}

