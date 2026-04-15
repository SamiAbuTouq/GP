import { ConfigService } from '@nestjs/config';
export declare class MailService {
    private readonly configService;
    private readonly logger;
    constructor(configService: ConfigService);
    private normalizeEnvValue;
    sendLecturerWelcomeEmail(params: {
        to: string;
        fullName: string;
        temporaryPassword: string;
    }): Promise<void>;
}
