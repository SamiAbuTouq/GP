import { NextResponse } from 'next/server'
import { proxyToBackend } from '@/lib/proxy-backend'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter')
  const qs =
    filter && filter !== 'all'
      ? `?filter=${encodeURIComponent(filter)}`
      : ''
  return proxyToBackend(`/timeslots${qs}`, { method: 'GET' })
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const payload: Record<string, unknown> = {
      days: body.days,
      start: body.start ?? body.startTime,
      end: body.end ?? body.endTime,
      slotType: body.slotType ?? body.type ?? 'Traditional Lecture',
      isSummer: Boolean(body.isSummer),
    }
    return proxyToBackend('/timeslots', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
}
