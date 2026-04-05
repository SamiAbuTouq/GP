import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and new password are required' },
        { status: 400 }
      );
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters and contain uppercase, lowercase, numbers, and special characters.' },
        { status: 400 }
      );
    }

    // Find the user with a valid, non-expired reset token
    const user = await prisma.user.findFirst({
      where: {
        reset_token: token,
        reset_token_expiry: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired password reset token' },
        { status: 400 }
      );
    }

    // Hash the new password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Update the user and clear the token
    await prisma.user.update({
      where: { user_id: user.user_id },
      data: {
        password_hash,
        reset_token: null,
        reset_token_expiry: null,
      },
    });

    return NextResponse.json({ success: true, message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Error in reset-password API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
