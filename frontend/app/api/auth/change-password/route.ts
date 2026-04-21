import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcrypt'
import { resolveUserFromRefreshCookie } from '@/lib/server-auth'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    // ─── SECURITY: Derive userId from the authenticated session ───────────────
    // NEVER accept userId from the request body — that would allow any user to
    // change another user's password (IDOR / account takeover).
    const sessionUser = await resolveUserFromRefreshCookie()
    if (!sessionUser?.sub) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      )
    }
    const userId = sessionUser.sub
    // ─────────────────────────────────────────────────────────────────────────

    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      )
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters long' },
        { status: 400 },
      )
    }

    if (!/[A-Z]/.test(newPassword)) {
      return NextResponse.json(
        { error: 'New password must contain at least one uppercase letter' },
        { status: 400 },
      )
    }

    if (!/[a-z]/.test(newPassword)) {
      return NextResponse.json(
        { error: 'New password must contain at least one lowercase letter' },
        { status: 400 },
      )
    }

    if (!/\d/.test(newPassword)) {
      return NextResponse.json(
        { error: 'New password must contain at least one number' },
        { status: 400 },
      )
    }

    // Find the user (always the session owner)
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify current password against the session owner's hash
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash)
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 },
      )
    }

    // Check if new password is different from current
    const isSamePassword = await bcrypt.compare(newPassword, user.password_hash)
    if (isSamePassword) {
      return NextResponse.json(
        { error: 'New password must be different from current password' },
        { status: 400 },
      )
    }

    const saltRounds = 12
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds)

    await prisma.user.update({
      where: { user_id: userId },
      data: {
        password_hash: newPasswordHash,
        must_change_password: false,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully',
    })
  } catch (error) {
    console.error('Error changing password:', error)

    if (
      error instanceof Error &&
      (error.message.includes('connect') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('database'))
    ) {
      return NextResponse.json(
        {
          error:
            'Unable to connect to database. Please check your DATABASE_URL configuration.',
        },
        { status: 503 },
      )
    }

    return NextResponse.json(
      { error: 'Failed to change password. Please try again.' },
      { status: 500 },
    )
  }
}
