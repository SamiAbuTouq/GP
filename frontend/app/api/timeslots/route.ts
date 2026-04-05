import { NextResponse } from 'next/server'
import { proxyToBackend } from '@/lib/proxy-backend'

export async function GET() {
  return proxyToBackend('/timeslots', { method: 'GET' })
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const payload = {
      days: body.days,
      start: body.start ?? body.startTime,
      end: body.end ?? body.endTime,
      slotType: body.slotType ?? body.type ?? 'Lecture',
    }
    return proxyToBackend('/timeslots', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
}
