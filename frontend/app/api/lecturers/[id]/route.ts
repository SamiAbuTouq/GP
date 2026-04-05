import { NextResponse } from 'next/server'
import { proxyToBackend } from '@/lib/proxy-backend'

function backendLecturerId(paramId: string): string {
  const id = paramId.trim()
  if (/^LEC\d+$/i.test(id)) {
    return String(parseInt(id.replace(/^LEC/i, ''), 10))
  }
  return encodeURIComponent(id)
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyToBackend(`/lecturers/${backendLecturerId(id)}`, { method: 'GET' })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = (await request.json()) as Record<string, unknown>
    const payload: Record<string, unknown> = {}
    if (body.name !== undefined) payload.name = body.name
    if (body.email !== undefined) payload.email = body.email
    if (body.department !== undefined) payload.department = body.department
    if (body.maxWorkload !== undefined) payload.maxWorkload = body.maxWorkload
    if (body.courses !== undefined) payload.courses = body.courses
    return proxyToBackend(`/lecturers/${backendLecturerId(id)}`, {
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
  return proxyToBackend(`/lecturers/${backendLecturerId(id)}`, { method: 'DELETE' })
}
