import { ConfigService } from "@nestjs/config";
export declare class MailService {
    private readonly configService;
    private readonly logger;
    constructor(configService: ConfigService);
    private escapeHtml;
    private normalizeEnvValue;
    private getSmtpAuthConfig;
    private buildTransportCandidates;
    private sendMailWithRetries;
    sendLecturerWelcomeEmail(params: {
        to: string;
        fullName: string;
        temporaryPassword: string;
    }): Promise<void>;
    sendLecturerAccessRequestRejectedEmail(params: {
        to: string;
        fullName: string;
        reason: string | null;
    }): Promise<void>;
    sendLecturerAccessRequestSubmittedEmail(params: {
        to: string;
        fullName: string;
        department: string;
        maxWorkload: number;
        courses: string[];
        submittedAtIso: string;
        expiresAtIso: string;
    }): Promise<void>;
}
