import { withContext, type AppDb, type SystemDb } from "@khmio/db";
import { createParamDecorator, Inject, Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { readCookie, resolveSession, SESSION_COOKIE } from "../auth/sessions";
import { APP_DB, SYSTEM_DB } from "../db";
import { AppException } from "../errors";

export interface MerchantStore {
  merchantId: string;
  storeId: string;
}

interface StoreRequest {
  headers: { cookie?: string };
  merchantStore?: MerchantStore;
}

/**
 * For every dashboard request about the merchant's shop: a live session, and
 * the store they belong to (Release 1: one store per merchant). The store is
 * looked up as the merchant, under row-level security.
 */
@Injectable()
export class MerchantStoreGuard implements CanActivate {
  constructor(
    @Inject(SYSTEM_DB) private readonly system: SystemDb,
    @Inject(APP_DB) private readonly app: AppDb,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<StoreRequest>();
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    const merchantId = token ? await resolveSession(this.system, token) : null;
    if (!merchantId) throw new UnauthorizedException();
    const membership = await withContext(this.app, { merchantId }, (tx) =>
      tx.storeMember.findFirst({ where: { merchantId }, orderBy: { createdAt: "asc" }, select: { storeId: true } }),
    );
    if (!membership) throw new AppException(403, "no_store");
    request.merchantStore = { merchantId, storeId: membership.storeId };
    return true;
  }
}

/** The signed-in merchant and their store, in a controller behind MerchantStoreGuard. */
export const CurrentStore = createParamDecorator((_data: unknown, context: ExecutionContext): MerchantStore => {
  const found = context.switchToHttp().getRequest<StoreRequest>().merchantStore;
  if (!found) throw new UnauthorizedException();
  return found;
});
