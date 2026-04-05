import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import dns from 'node:dns';
import net from 'node:net';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';

dns.setDefaultResultOrder('ipv4first');

/** Trim and strip a single layer of surrounding quotes (common in .env on Windows). */
function normalizeEnvValue(v: string | undefined): string | undefined {
  if (v === undefined) return undefined;
  let s = v.trim();
  if (s.length === 0) return undefined;
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s.length > 0 ? s : undefined;
}

/**
 * Nodemailer resolves A+AAAA and picks a *random* address; on many Windows networks IPv6 to Google fails (ENETUNREACH).
 * Connect to an IPv4 literal and set servername for TLS/SNI.
 */
async function smtpIpv4Target(hostname: string): Promise<{ host: string; servername: string }> {
  const name = hostname.trim();
  if (net.isIP(name)) {
    return { host: name, servername: name };
  }
  try {
    const { address } = await dns.promises.lookup(name, { family: 4 });
    return { host: address, servername: name };
  } catch {
    return { host: name, servername: name };
  }
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
    });

    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists, a reset link has been sent.',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000);

    await prisma.user.update({
      where: { user_id: user.user_id },
      data: {
        reset_token: token,
        reset_token_expiry: expiry,
      },
    });

    const appBase =
      normalizeEnvValue(process.env.NEXT_PUBLIC_APP_URL) ||
      normalizeEnvValue(process.env.PASSWORD_RESET_APP_URL) ||
      'http://localhost:3000';
    const resetUrl = `${appBase.replace(/\/$/, '')}/reset-password?token=${token}`;
    const fromName =
      normalizeEnvValue(process.env.EMAIL_FROM_NAME) ||
      'University Timetabling System';

    const smtpUser = normalizeEnvValue(process.env.SMTP_USER);
    let smtpPass = normalizeEnvValue(process.env.SMTP_PASS);
    if (
      smtpPass &&
      smtpUser &&
      /@gmail\.com$|@googlemail\.com$/i.test(smtpUser)
    ) {
      smtpPass = smtpPass.replace(/\s+/g, '');
    }

    let transporter: nodemailer.Transporter;
    let fromAddress: string;

    if (smtpUser && smtpPass) {
      const logicalHost =
        normalizeEnvValue(process.env.SMTP_HOST) || 'smtp.gmail.com';
      const { host, servername } = await smtpIpv4Target(logicalHost);
      const port = Number(
        normalizeEnvValue(process.env.SMTP_PORT) || '587',
      );
      const secureExplicit =
        normalizeEnvValue(process.env.SMTP_SECURE) === 'true';
      const secure = secureExplicit || port === 465;

      transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        servername,
        requireTLS: !secure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          minVersion: 'TLSv1.2',
        },
      });
      fromAddress = normalizeEnvValue(process.env.SMTP_FROM) || smtpUser;
    } else {
      const testAccount = await nodemailer.createTestAccount();
      const { host, servername } = await smtpIpv4Target('smtp.ethereal.email');
      transporter = nodemailer.createTransport({
        host,
        port: 587,
        secure: false,
        servername,
        requireTLS: true,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      fromAddress = testAccount.user;
    }

    const from = `"${fromName}" <${fromAddress}>`;

    const mailPayload = {
      from,
      ...(smtpUser
        ? {
            replyTo:
              normalizeEnvValue(process.env.SMTP_REPLY_TO) || smtpUser,
          }
        : {}),
      to: user.email,
      subject: 'Password Reset Request - University Timetabling System',
      text: `You requested a password reset. Please click the following link: ${resetUrl}`,
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
              <p style="color: #64748b; font-size: 14px; margin-bottom: 20px;">This link will expire soon for security reasons.</p>
              <p style="color: #475569; font-size: 14px; margin-bottom: 10px;">If the button does not work, copy and paste this URL into your browser:</p>
              <p style="margin-bottom: 30px;">
                <a href="${resetUrl}" style="color: #2563eb; font-size: 14px; text-decoration: underline; word-break: break-all;">${resetUrl}</a>
              </p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin: 0;">
                  If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged unless this link is used.
                </p>
              </div>
              <p style="color: #94a3b8; font-size: 13px; margin: 0;">Please do not reply to this message. This mailbox is not monitored.</p>
            </div>
          </div>
        </div>
      `,
    };

    let info: nodemailer.SentMessageInfo;
    try {
      info = await transporter.sendMail(mailPayload);
    } catch (mailErr: unknown) {
      console.error('SMTP send failed:', mailErr);
      if (process.env.NODE_ENV === 'development') {
        console.log(
          '\n========== PASSWORD RESET LINK (dev — email failed; paste into browser) ==========\n' +
            resetUrl +
            '\n================================================================================\n'
        );
        return NextResponse.json({
          success: true,
          message: 'If an account exists, a reset link has been sent.',
        });
      }
      throw mailErr;
    }

    console.log(
      `Password reset email sent from ${fromAddress} to: ${user.email}`,
    );

    if (!smtpUser) {
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
      console.log('NOTE: Ethereal test mail — open Preview URL in the console above.');
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists, a reset link has been sent.',
    });
  } catch (error: unknown) {
    console.error('Error in forgot-password API:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
