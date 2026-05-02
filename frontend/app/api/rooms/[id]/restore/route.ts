import { proxyToBackend } from '@/lib/proxy-backend'

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return proxyToBackend(`/rooms/${encodeURIComponent(id)}/restore`, { method: 'PATCH' })
}

