import { NextResponse } from 'next/server'
import { proxyToBackend } from '@/lib/proxy-backend'

export async function GET() {
  return proxyToBackend('/rooms', { method: 'GET' })
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const payload = {
      id: String(body.id ?? body.number ?? '').trim(),
      type: String(body.type ?? 'Classroom'),
      capacity: Number(body.capacity),
      isAvailable: body.isAvailable ?? true,
    }
    return proxyToBackend('/rooms', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
}
