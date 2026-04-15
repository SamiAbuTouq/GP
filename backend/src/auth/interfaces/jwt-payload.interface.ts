import type { Role } from '@prisma/client';

export interface JwtPayload {
  sub: number; // user_id
  email: string;
  role: Role;
  requires_password_change: boolean;
}
