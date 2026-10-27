import type { SystemDb } from "@khmio/db";
import { createParamDecorator, Inject, Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { SYSTEM_DB } from "../db";
import { readCookie, resolveSession, SESSION_COOKIE } from "./sessions";

interface SessionRequest {
  headers: { cookie?: string };
  merchantId?: string;
}

/** Lets a request through only with a live session cookie, and remembers whose it is. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(SYSTEM_DB) private readonly db: SystemDb) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    const merchantId = token ? await resolveSession(this.db, token) : null;
    if (!merchantId) throw new UnauthorizedException();
    request.merchantId = merchantId;
    return true;
  }
}

/** The signed-in merchant's id, in a controller behind SessionGuard. */
export const CurrentMerchant = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const merchantId = context.switchToHttp().getRequest<SessionRequest>().merchantId;
  if (!merchantId) throw new UnauthorizedException();
  return merchantId;
});
