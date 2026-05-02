import { proxyToBackend } from '@/lib/proxy-backend'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return proxyToBackend(`/courses/${encodeURIComponent(id)}/permanent`, {
    method: 'DELETE',
  })
}

