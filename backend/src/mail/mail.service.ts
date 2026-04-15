import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  /** Trim and strip a single layer of surrounding quotes (common in .env on Windows). */
  private normalizeEnvValue(v: string | undefined): string | undefined {
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

  async sendLecturerWelcomeEmail(params: {
    to: string;
    fullName: string;
    temporaryPassword: string;
  }): Promise<void> {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT', '587'));
    const secure = this.configService.get<string>('SMTP_SECURE', 'false') === 'true';
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!host || !user || !pass) {
      this.logger.warn(
        `Welcome email skipped for ${params.to}: SMTP configuration is incomplete.`,
      );
      return;
    }

    const fromName = this.configService.get<string>(
      'EMAIL_FROM_NAME',
      'University Timetabling System',
    );
    const fromAddress = this.configService.get<string>('SMTP_FROM', user);
    const replyTo = this.configService.get<string>('SMTP_REPLY_TO', user);

    const appBase =
      this.normalizeEnvValue(this.configService.get<string>('NEXT_PUBLIC_APP_URL')) ||
      this.normalizeEnvValue(this.configService.get<string>('APP_URL')) ||
      'http://localhost:3000';
    const firstLoginUrl = `${appBase.replace(/\/$/, '')}/first-login-password`;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    const subject = 'Your Lecturer Account Credentials';
    const text = [
      `Hello ${params.fullName},`,
      '',
      'Your lecturer account has been created.',
      `Email: ${params.to}`,
      `Temporary password: ${params.temporaryPassword}`,
      '',
      `Sign in and set your password: ${firstLoginUrl}`,
      '',
      'For security reasons, you must change this password on your first login.',
    ].join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; background-color: #f4f5f7; padding: 40px 20px; min-height: 100%;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
          <div style="background-color: #1a365d; padding: 30px; text-align: left;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: bold;">University Timetabling System</h1>
            <p style="color: #cbd5e1; margin: 8px 0 0 0; font-size: 14px;">Account Access Details</p>
          </div>

          <div style="padding: 40px 30px;">
            <h2 style="color: #0f172a; font-size: 24px; margin-top: 0; margin-bottom: 20px;">Your Lecturer Account</h2>

            <p style="color: #475569; font-size: 16px; line-height: 1.5; margin-bottom: 18px;">
              Hello ${params.fullName},
            </p>
            <p style="color: #475569; font-size: 16px; line-height: 1.5; margin-bottom: 26px;">
              Your lecturer account has been created. Use the credentials below to sign in.
            </p>

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 18px; margin-bottom: 26px;">
              <p style="color: #0f172a; font-size: 14px; margin: 0 0 10px 0; font-weight: bold;">Login credentials</p>
              <p style="color: #475569; font-size: 14px; margin: 0 0 8px 0;">
                <span style="color: #64748b;">Email:</span>
                <span style="font-weight: bold;"> ${params.to}</span>
              </p>
              <p style="color: #475569; font-size: 14px; margin: 0;">
                <span style="color: #64748b;">Temporary password:</span>
                <span style="font-weight: bold;"> ${params.temporaryPassword}</span>
              </p>
            </div>

            <div style="margin-bottom: 18px;">
              <a href="${firstLoginUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">
                Sign in and set your password
              </a>
            </div>

            <p style="color: #64748b; font-size: 14px; margin-bottom: 20px;">
              For security reasons, you will be required to change your password on your first login.
            </p>

            <p style="color: #475569; font-size: 14px; margin-bottom: 10px;">If the button does not work, copy and paste this URL into your browser:</p>
            <p style="margin-bottom: 28px;">
              <a href="${firstLoginUrl}" style="color: #2563eb; font-size: 14px; text-decoration: underline; word-break: break-all;">${firstLoginUrl}</a>
            </p>

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
              <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin: 0;">
                If you did not expect this email, please contact IT Support immediately.
              </p>
            </div>

            <p style="color: #94a3b8; font-size: 13px; margin: 0;">Please do not reply to this message. This mailbox is not monitored.</p>
          </div>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      replyTo,
      to: params.to,
      subject,
      text,
      html,
    });
  }
}
