import { proxyToBackend } from '@/lib/proxy-backend'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyToBackend(`/rooms/${encodeURIComponent(id)}`, { method: 'GET' })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.text()
  return proxyToBackend(`/rooms/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body,
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyToBackend(`/rooms/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
