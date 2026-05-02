import { proxyToBackend } from '@/lib/proxy-backend'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return proxyToBackend(`/timeslots/${encodeURIComponent(id)}/permanent`, {
    method: 'DELETE',
  })
}

