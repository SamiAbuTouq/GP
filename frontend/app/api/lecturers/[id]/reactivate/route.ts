import { proxyToBackend } from '@/lib/proxy-backend'

function backendLecturerId(paramId: string): string {
  const id = paramId.trim()
  if (/^LEC\d+$/i.test(id)) {
    return String(parseInt(id.replace(/^LEC/i, ''), 10))
  }
  return encodeURIComponent(id)
}

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return proxyToBackend(`/lecturers/${backendLecturerId(id)}/reactivate`, {
    method: 'PATCH',
  })
}

