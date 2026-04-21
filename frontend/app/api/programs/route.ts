import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { requireAdminFromRefreshCookie } from '@/lib/server-auth'

const PROGRAMS_FILE = path.join(process.cwd(), 'programs.json')

export async function GET() {
  const auth = await requireAdminFromRefreshCookie()
  if (!auth.ok) return auth.response

  try {
    const data = await fs.readFile(PROGRAMS_FILE, 'utf8')
    return NextResponse.json(JSON.parse(data))
  } catch (error) {
    console.error('[GET /api/programs]', error)
    return NextResponse.json({ error: 'Failed to read programs data.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminFromRefreshCookie()
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    await fs.writeFile(PROGRAMS_FILE, JSON.stringify(body, null, 2), 'utf8')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[POST /api/programs]', error)
    return NextResponse.json({ error: 'Failed to update programs data.' }, { status: 500 })
  }
}
