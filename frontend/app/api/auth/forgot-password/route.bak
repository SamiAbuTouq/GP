import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { 
        email: {
          equals: email,
          mode: 'insensitive'
        }
      },
    });

    if (!user) {
      // Return success even if user not found to prevent email enumeration
      return NextResponse.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000); // 1 hour from now

    await prisma.user.update({
      where: { user_id: user.user_id },
      data: {
        reset_token: token,
        reset_token_expiry: expiry,
      },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    
    // Set up nodemailer transporter
    let transporter;
    
    // If user provided SMTP credentials, use them
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        service: 'gmail', // You can change this or configure host/port for other providers
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      // Fallback: Create a test account dynamically using Ethereal
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: testAccount.user, // generated ethereal user
          pass: testAccount.pass, // generated ethereal password
        },
      });
    }

    // Send email
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'University Timetabling System'}" <${process.env.SMTP_USER}>`, // sender address
      replyTo: 'noreply@gmail.com', 
      to: user.email, // list of receivers
  subject: 'Password Reset Request - University Timetabling System', // ← more specific subject
      text: `You requested a password reset. Please click the following link: ${resetUrl}`, // plain text body
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f4f5f7; padding: 40px 20px; min-height: 100%;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
            <div style="background-color: #1a365d; padding: 30px; text-align: left;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: bold;">University Timetabling System</h1>
              <p style="color: #cbd5e1; margin: 8px 0 0 0; font-size: 14px;">Account Security Notification</p>
            </div>
            
            <div style="padding: 40px 30px;">
              <h2 style="color: #0f172a; font-size: 24px; margin-top: 0; margin-bottom: 20px;">Reset Your Password</h2>
              
              <p style="color: #475569; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
                We received a request to reset the password for your account. Click the button below to create a new password and regain access securely.
              </p>
              
              <div style="margin-bottom: 30px;">
                <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">
                  Reset Password
                </a>
              </div>
              
              <p style="color: #64748b; font-size: 14px; margin-bottom: 20px;">
                This link will expire soon for security reasons.
              </p>
              
              <p style="color: #475569; font-size: 14px; margin-bottom: 10px;">
                If the button does not work, copy and paste this URL into your browser:
              </p>
              <p style="margin-bottom: 30px;">
                <a href="${resetUrl}" style="color: #2563eb; font-size: 14px; text-decoration: underline; word-break: break-all;">
                  ${resetUrl}
                </a>
              </p>
              
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin: 0;">
                  If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged unless this link is used.
                </p>
              </div>
              
              <p style="color: #94a3b8; font-size: 13px; margin: 0;">
                Please do not reply to this message. This mailbox is not monitored.
              </p>
            </div>
          </div>
        </div>
      `, // html body
    });

    console.log(`Password reset email sent to: ${user.email}`);
    
    // If we used a test account, we log the URL to preview the email
    if (!process.env.SMTP_USER) {
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
      console.log('NOTE: Since no SMTP credentials were provided (.env SMTP_USER and SMTP_PASS), we used a test Ethereal account. Open the Preview URL to see the email!');
    }

    return NextResponse.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
  } catch (error: any) {
    console.error('Error in forgot-password API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
