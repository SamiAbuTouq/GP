import { NextResponse } from 'next/server'
import { proxyToBackend } from '@/lib/proxy-backend'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyToBackend(`/courses/${encodeURIComponent(id)}`, { method: 'GET' })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = (await request.json()) as Record<string, unknown>
    const payload: Record<string, unknown> = {}
    if (body.name !== undefined) payload.name = body.name
    if (body.creditHours !== undefined) payload.creditHours = body.creditHours
    if (body.academicLevel !== undefined) payload.academicLevel = body.academicLevel
    if (body.deliveryMode !== undefined) payload.deliveryMode = body.deliveryMode
    if (body.department !== undefined) payload.department = body.department
    if (body.sectionsNormal !== undefined) {
      const n = Number(body.sectionsNormal)
      payload.sectionsNormal = Number.isFinite(n)
        ? Math.min(20, Math.max(0, Math.trunc(n)))
        : 1
    }
    if (body.sectionsSummer !== undefined) {
      const n = Number(body.sectionsSummer)
      payload.sectionsSummer = Number.isFinite(n)
        ? Math.min(20, Math.max(0, Math.trunc(n)))
        : 0
    }
    if (body.isLab !== undefined) payload.isLab = Boolean(body.isLab)
    return proxyToBackend(`/courses/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyToBackend(`/courses/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
