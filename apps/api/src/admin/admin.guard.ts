import type { SystemDb } from "@khmio/db";
import { adminCan, type AdminPermission } from "@khmio/shared";
import { createParamDecorator, ForbiddenException, Inject, Injectable, SetMetadata, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { readCookie } from "../auth/sessions";
import { SYSTEM_DB } from "../db";
import { ADMIN_COOKIE, readAdminSession, type AdminIdentity } from "./admin-auth";

interface AdminRequest {
  headers: { cookie?: string };
  admin?: AdminIdentity;
}

const PERMISSION_KEY = "admin_permission";

/** The permission a route needs (packages/shared admin-roles.ts). Every admin route names one. */
export const AdminPermissionNeeded = (permission: AdminPermission) => SetMetadata(PERMISSION_KEY, permission);

/**
 * Lets through only a fully signed-in admin (both login steps) whose role
 * has the route's permission. A seller's cookie never counts: admin sessions
 * are their own table and cookie. A route without a named permission is refused.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @Inject(SYSTEM_DB) private readonly db: SystemDb,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const token = readCookie(request.headers.cookie, ADMIN_COOKIE);
    const session = token ? await readAdminSession(this.db, token) : null;
    if (!session || session.stage !== "active") throw new UnauthorizedException();
    const permission = this.reflector.getAllAndOverride<AdminPermission | undefined>(PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (!permission || !adminCan(session.admin.role, permission)) throw new ForbiddenException();
    request.admin = session.admin;
    return true;
  }
}

/** The signed-in admin, in a controller behind AdminGuard. */
export const CurrentAdmin = createParamDecorator((_data: unknown, context: ExecutionContext): AdminIdentity => {
  const admin = context.switchToHttp().getRequest<AdminRequest>().admin;
  if (!admin) throw new UnauthorizedException();
  return admin;
});
