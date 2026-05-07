"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var MailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nodemailer_1 = __importDefault(require("nodemailer"));
let MailService = MailService_1 = class MailService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(MailService_1.name);
    }
    escapeHtml(value) {
        return value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
    normalizeEnvValue(v) {
        if (v === undefined)
            return undefined;
        let s = v.trim();
        if (s.length === 0)
            return undefined;
        if ((s.startsWith('"') && s.endsWith('"')) ||
            (s.startsWith("'") && s.endsWith("'"))) {
            s = s.slice(1, -1).trim();
        }
        return s.length > 0 ? s : undefined;
    }
    getSmtpAuthConfig() {
        const host = this.configService.get("SMTP_HOST");
        const port = Number(this.configService.get("SMTP_PORT", "587"));
        const secure = this.configService.get("SMTP_SECURE", "false") === "true";
        const user = this.configService.get("SMTP_USER");
        const pass = this.configService.get("SMTP_PASS");
        if (!host || !user || !pass)
            return null;
        return { host, port, secure, user, pass };
    }
    buildTransportCandidates(config) {
        const base = {
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: { user: config.user, pass: config.pass },
            connectionTimeout: 15000,
            greetingTimeout: 15000,
            socketTimeout: 30000,
        };
        const candidates = [base];
        const hostLower = config.host.toLowerCase();
        if (hostLower.includes("gmail")) {
            if (config.port === 587) {
                candidates.push({ ...base, port: 465, secure: true });
            }
            else if (config.port === 465) {
                candidates.push({ ...base, port: 587, secure: false });
            }
        }
        return candidates;
    }
    async sendMailWithRetries(mailOptions, contextLabel) {
        const config = this.getSmtpAuthConfig();
        if (!config) {
            this.logger.warn(`${contextLabel} email skipped: SMTP configuration is incomplete.`);
            return;
        }
        const candidates = this.buildTransportCandidates(config);
        let lastError = null;
        for (const candidate of candidates) {
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    const transporter = nodemailer_1.default.createTransport(candidate);
                    await transporter.sendMail(mailOptions);
                    if (attempt > 1) {
                        this.logger.log(`${contextLabel} email succeeded on retry ${attempt}.`);
                    }
                    return;
                }
                catch (error) {
                    lastError = error;
                    this.logger.warn(`${contextLabel} email attempt ${attempt} failed via ${candidate.host}:${candidate.port}.`);
                }
            }
        }
        throw lastError instanceof Error
            ? lastError
            : new Error("Email delivery failed.");
    }
    async sendLecturerWelcomeEmail(params) {
        const smtpConfig = this.getSmtpAuthConfig();
        if (!smtpConfig) {
            this.logger.warn(`Welcome email skipped for ${params.to}: SMTP configuration is incomplete.`);
            return;
        }
        const fromName = this.configService.get("EMAIL_FROM_NAME", "Smart University Timetable System");
        const fromAddress = this.configService.get("SMTP_FROM", smtpConfig.user);
        const replyTo = this.configService.get("SMTP_REPLY_TO", smtpConfig.user);
        const appBase = this.normalizeEnvValue(this.configService.get("NEXT_PUBLIC_APP_URL")) ||
            this.normalizeEnvValue(this.configService.get("APP_URL")) ||
            "http://localhost:3000";
        const firstLoginUrl = `${appBase.replace(/\/$/, "")}/first-login-password`;
        const subject = "Your Lecturer Account Credentials";
        const text = [
            `Hello ${params.fullName},`,
            "",
            "Your lecturer account has been created.",
            `Email: ${params.to}`,
            `Temporary password: ${params.temporaryPassword}`,
            "",
            `Sign in and set your password: ${firstLoginUrl}`,
            "",
            "For security reasons, you must change this password on your first login.",
        ].join("\n");
        const html = `
      <div style="font-family: Arial, sans-serif; background-color: #f4f5f7; padding: 40px 20px; min-height: 100%;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
          <div style="background-color: #1a365d; padding: 30px; text-align: left;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: bold;">Smart University Timetable System</h1>
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
        await this.sendMailWithRetries({
            from: `"${fromName}" <${fromAddress}>`,
            replyTo,
            to: params.to,
            subject,
            text,
            html,
        }, `Welcome (${params.to})`);
    }
    async sendLecturerAccessRequestRejectedEmail(params) {
        const smtpConfig = this.getSmtpAuthConfig();
        if (!smtpConfig) {
            this.logger.warn(`Access request rejection email skipped for ${params.to}: SMTP configuration is incomplete.`);
            return;
        }
        const fromName = this.configService.get("EMAIL_FROM_NAME", "Smart University Timetable System");
        const fromAddress = this.configService.get("SMTP_FROM", smtpConfig.user);
        const replyTo = this.configService.get("SMTP_REPLY_TO", smtpConfig.user);
        const genericReason = "At this time, we are unable to approve your access request. Please contact IT support for assistance.";
        const finalReason = params.reason?.trim() || genericReason;
        const subject = "Lecturer Access Request Update";
        const text = [
            `Hello ${params.fullName},`,
            "",
            "Your lecturer access request was not approved.",
            "",
            `Reason: ${finalReason}`,
            "",
            "If you have questions, please contact IT support.",
        ].join("\n");
        const html = `
      <div style="font-family: Arial, sans-serif; background-color: #f4f5f7; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
          <div style="background-color: #1a365d; padding: 30px;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px;">Smart University Timetable System</h1>
            <p style="color: #cbd5e1; margin: 8px 0 0 0; font-size: 14px;">Access Request Update</p>
          </div>
          <div style="padding: 30px;">
            <p style="color: #475569; font-size: 16px;">Hello ${params.fullName},</p>
            <p style="color: #475569; font-size: 16px;">Your lecturer access request was not approved.</p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-top: 16px;">
              <p style="color: #0f172a; font-size: 14px; margin: 0 0 8px 0; font-weight: bold;">Reason</p>
              <p style="color: #475569; font-size: 14px; margin: 0;">${finalReason}</p>
            </div>
            <p style="color: #64748b; font-size: 14px; margin-top: 20px;">If you have questions, please contact IT support.</p>
          </div>
        </div>
      </div>
    `;
        await this.sendMailWithRetries({
            from: `"${fromName}" <${fromAddress}>`,
            replyTo,
            to: params.to,
            subject,
            text,
            html,
        }, `Access request rejected (${params.to})`);
    }
    async sendLecturerAccessRequestSubmittedEmail(params) {
        const smtpConfig = this.getSmtpAuthConfig();
        if (!smtpConfig) {
            this.logger.warn(`Access request confirmation email skipped for ${params.to}: SMTP configuration is incomplete.`);
            return;
        }
        const fromName = this.configService.get("EMAIL_FROM_NAME", "Smart University Timetable System");
        const fromAddress = this.configService.get("SMTP_FROM", smtpConfig.user);
        const replyTo = this.configService.get("SMTP_REPLY_TO", smtpConfig.user);
        const submittedAt = new Date(params.submittedAtIso).toLocaleString();
        const expiresAt = new Date(params.expiresAtIso).toLocaleString();
        const coursesTextBlock = params.courses.length > 0
            ? params.courses.map((c) => `  • ${c}`).join("\n")
            : "  • None selected";
        const coursesHtmlBlock = params.courses.length > 0
            ? `<ul style="margin: 8px 0 0 18px; padding: 0; color: #475569; font-size: 14px; line-height: 1.55;">
            ${params.courses
                .map((c) => `<li style="margin: 4px 0;">${this.escapeHtml(c)}</li>`)
                .join("")}
          </ul>`
            : `<p style="margin: 8px 0 0 0; color: #64748b; font-size: 14px;">None selected</p>`;
        const safeName = this.escapeHtml(params.fullName);
        const safeEmail = this.escapeHtml(params.to);
        const safeDept = this.escapeHtml(params.department);
        const subject = "Lecturer Access Request Received";
        const text = [
            `Hello ${params.fullName},`,
            "",
            "We received your lecturer access request. It is now pending review.",
            "",
            "Submitted details:",
            `- Name: ${params.fullName}`,
            `- Email: ${params.to}`,
            `- Department: ${params.department}`,
            `- Max workload (hrs) for bachelor's degree: ${params.maxWorkload}`,
            "- Courses you can teach:",
            coursesTextBlock,
            `- Submitted at: ${submittedAt}`,
            "",
            `If no action is taken, requests expire after 14 days (${expiresAt}).`,
        ].join("\n");
        const html = `
      <div style="font-family: Arial, sans-serif; background-color: #f4f5f7; padding: 40px 20px;">
        <div style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
          <div style="background-color: #1a365d; padding: 30px;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px;">Smart University Timetable System</h1>
            <p style="color: #cbd5e1; margin: 8px 0 0 0; font-size: 14px;">Lecturer Access Request</p>
          </div>
          <div style="padding: 30px;">
            <p style="color: #475569; font-size: 16px;">Hello ${safeName},</p>
            <p style="color: #475569; font-size: 16px; margin-bottom: 18px;">
              Your lecturer access request has been received and is now pending review.
            </p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
              <p style="margin: 0 0 10px 0; color: #0f172a; font-weight: bold; font-size: 14px;">Submitted details</p>
              <p style="margin: 6px 0; color: #475569; font-size: 14px;"><b>Name:</b> ${safeName}</p>
              <p style="margin: 6px 0; color: #475569; font-size: 14px;"><b>Email:</b> <a href="mailto:${safeEmail}" style="color: #2563eb; word-break: break-all;">${safeEmail}</a></p>
              <p style="margin: 6px 0; color: #475569; font-size: 14px;"><b>Department:</b> ${safeDept}</p>
              <p style="margin: 6px 0; color: #475569; font-size: 14px;"><b>Max workload (hrs) for bachelor&apos;s degree:</b> ${params.maxWorkload}</p>
              <div style="margin: 12px 0 0 0;">
                <p style="margin: 0; color: #0f172a; font-weight: bold; font-size: 14px;">Courses you can teach</p>
                ${coursesHtmlBlock}
              </div>
              <p style="margin: 12px 0 0 0; color: #475569; font-size: 14px;"><b>Submitted at:</b> ${submittedAt}</p>
            </div>
            <p style="color: #64748b; font-size: 14px; margin-top: 16px;">
              If no action is taken, requests expire after 14 days (${expiresAt}).
            </p>
          </div>
        </div>
      </div>
    `;
        await this.sendMailWithRetries({
            from: `"${fromName}" <${fromAddress}>`,
            replyTo,
            to: params.to,
            subject,
            text,
            html,
        }, `Access request confirmation (${params.to})`);
    }
};
exports.MailService = MailService;
exports.MailService = MailService = MailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MailService);
//# sourceMappingURL=mail.service.js.map