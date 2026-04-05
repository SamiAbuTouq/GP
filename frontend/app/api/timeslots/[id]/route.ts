import { NextResponse } from 'next/server'
import { proxyToBackend } from '@/lib/proxy-backend'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyToBackend(`/timeslots/${encodeURIComponent(id)}`, { method: 'GET' })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = (await request.json()) as Record<string, unknown>
    const payload: Record<string, unknown> = {}
    if (body.days !== undefined) payload.days = body.days
    if (body.start !== undefined || body.startTime !== undefined) {
      payload.start = body.start ?? body.startTime
    }
    if (body.end !== undefined || body.endTime !== undefined) {
      payload.end = body.end ?? body.endTime
    }
    if (body.slotType !== undefined || body.type !== undefined) {
      payload.slotType = body.slotType ?? body.type
    }
    return proxyToBackend(`/timeslots/${encodeURIComponent(id)}`, {
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
  return proxyToBackend(`/timeslots/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
