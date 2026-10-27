import type { AppDb } from "@khmio/db";
import { Controller, Get, Inject, Res } from "@nestjs/common";
import { APP_DB } from "../db";

interface StatusResponse {
  status(code: number): unknown;
}

/**
 * For the host's health check and uptime alerts: 200 when the API can reach
 * the database as its everyday user, 503 when it can't. Says nothing else.
 */
@Controller("health")
export class HealthController {
  constructor(@Inject(APP_DB) private readonly db: AppDb) {}

  @Get()
  async check(@Res({ passthrough: true }) res: StatusResponse) {
    const database = await this.db.$queryRaw`SELECT 1`
      .then(() => "up" as const)
      .catch(() => "down" as const);
    if (database === "down") res.status(503);
    return { status: database === "up" ? "ok" : "degraded", database };
  }
}
