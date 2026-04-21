import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip role check on @Public() routes — they bypass JWT entirely
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const { user } = context.switchToHttp().getRequest();

    // No authenticated user at this point — JWT guard should have caught this,
    // but we defend in depth.
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const userRole: string = user.role_name ?? user.role ?? '';

    // If no @Roles() decorator is set, enforce ADMIN-only as a secure default.
    // This prevents Lecturers from accessing endpoints that forgot the annotation.
    if (!requiredRoles || requiredRoles.length === 0) {
      if (userRole !== Role.ADMIN) {
        throw new ForbiddenException(
          'Insufficient permissions — this resource requires ADMIN access',
        );
      }
      return true;
    }

    if (!requiredRoles.includes(userRole as Role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}

