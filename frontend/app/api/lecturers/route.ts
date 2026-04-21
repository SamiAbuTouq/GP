import { NextResponse } from 'next/server'
import { proxyToBackend } from '@/lib/proxy-backend'

export async function GET() {
  return proxyToBackend('/lecturers', { method: 'GET' })
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const parsedMaxWorkload = Number(body.maxWorkload)
    const payload: Record<string, unknown> = {
      name: String(body.name ?? '').trim(),
      email: String(body.email ?? '').trim().toLowerCase(),
      department: String(body.department ?? '').trim(),
      maxWorkload: Number.isFinite(parsedMaxWorkload) ? parsedMaxWorkload : 15,
    }
    if (Array.isArray(body.courses)) {
      payload.courses = body.courses
    }
    return proxyToBackend('/lecturers', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
}
