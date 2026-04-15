import type { Role } from '@prisma/client';
export interface JwtPayload {
    sub: number;
    email: string;
    role: Role;
    requires_password_change: boolean;
}
