import { NextResponse } from 'next/server'

/**
 * Base URL for the NestJS API (must include /api/v1).
 * Prefer BACKEND_API_URL for server-side-only config; fall back to NEXT_PUBLIC_API_URL.
 */
export function getBackendApiUrl(): string {
  const raw =
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3001/api/v1'
  return raw.replace(/\/$/, '')
}

function mergeBackendError<T extends Record<string, unknown>>(obj: T): T {
  if (obj.error !== undefined) return obj
  const m = obj.message
  if (m !== undefined) {
    const errMsg = Array.isArray(m) ? m.join(', ') : String(m)
    return { ...obj, error: errMsg }
  }
  return obj
}

/**
 * Forwards a request to NestJS and returns a NextResponse with the same status and JSON body.
 * Adds `error` from Nest's `message` when missing, for UI that reads `data.error`.
 */
export async function proxyToBackend(
  path: string,
  init: RequestInit
): Promise<NextResponse> {
  const base = getBackendApiUrl()
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  }
  if (init.body !== undefined && init.body !== null && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  let res: Response
  try {
    res = await fetch(url, { ...init, headers })
  } catch (e) {
    console.error('proxyToBackend fetch failed:', url, e)
    return NextResponse.json(
      { error: 'Cannot reach the API server. Is the backend running?' },
      { status: 502 }
    )
  }

  const text = await res.text()
  if (!text) {
    return new NextResponse(null, { status: res.status })
  }

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    if (typeof parsed === 'object' && parsed !== null && !res.ok) {
      return NextResponse.json(mergeBackendError(parsed), { status: res.status })
    }
    return NextResponse.json(parsed, { status: res.status })
  } catch {
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'text/plain' },
    })
  }
}

export async function proxyRequest(path: string, request: Request): Promise<NextResponse> {
  const method = request.method
  const body =
    method === 'GET' || method === 'HEAD' || method === 'OPTIONS'
      ? undefined
      : await request.text()
  return proxyToBackend(path, { method, body })
}
