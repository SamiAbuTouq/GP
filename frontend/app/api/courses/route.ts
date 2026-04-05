import { NextResponse } from 'next/server'
import { proxyToBackend } from '@/lib/proxy-backend'

export async function GET() {
  return proxyToBackend('/courses', { method: 'GET' })
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const sectionsRaw = body.sections
    const sectionsNum =
      sectionsRaw === undefined || sectionsRaw === null
        ? 1
        : Math.min(20, Math.max(1, Number(sectionsRaw) || 1))

    const payload = {
      code: String(body.code ?? '').trim(),
      name: String(body.name ?? '').trim(),
      creditHours: Number(body.creditHours),
      academicLevel: Number(body.academicLevel),
      deliveryMode: String(body.deliveryMode ?? 'On-Campus').trim(),
      department: String(body.department ?? '').trim(),
      sections: sectionsNum,
    }
    return proxyToBackend('/courses', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
}
