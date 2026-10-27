import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import { toFieldErrors, type FormErrorCode } from "@khmio/shared";
import type { Logger } from "pino";
import { ZodError } from "zod";
import { RateLimitedException } from "./security/rate-limit";
import { captureError } from "./sentry";

/**
 * Every error the API sends has one shape. Bad input names each field with
 * the same codes the screens already translate (packages/shared form-errors.ts),
 * so a form shows the API's answer exactly as it shows its own checks.
 */
export type ErrorBody =
  | { error: "invalid_input"; fields: Record<string, FormErrorCode> }
  | {
      error:
        | "bad_request"
        | "unauthorized"
        | "forbidden"
        | "not_found"
        | "conflict"
        | "too_large"
        | "too_many_requests"
        | "internal"
        // The merchant has no store yet (onboarding not finished).
        | "no_store"
        // The plan's limit is reached (packages/shared plans.ts).
        | "plan_limit"
        // The store is paused: everything stays readable, nothing can be changed.
        | "store_paused"
        // The shop can't take orders yet (no delivery saved, or no way for this buyer to pay).
        | "not_accepting_orders"
        // The order has moved on (or this step doesn't follow its status): nothing was changed.
        | "action_not_allowed"
        // ADMIN_SECRETS_KEY isn't set: the admin login can't run.
        | "admin_not_configured"
        // Too many wrong two-step codes: try again in 15 minutes.
        | "code_locked"
        // The shop is paused: it takes no orders until it reopens.
        | "store_closed"
        // TELEGRAM_BOT_TOKEN isn't set: no Telegram links.
        | "telegram_not_configured"
        // Cloudflare Turnstile said this checkout isn't from a person (or no token was sent).
        | "bot_check_failed"
        // Admin "Backup now" while a backup is already waiting or running.
        | "backup_running"
        // The shop switched off the module this needs (packages/shared business-modules.ts).
        | "module_off";
    };

const CODE_BY_STATUS: Record<number, Exclude<ErrorBody["error"], "invalid_input">> = {
  400: "bad_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  413: "too_large",
  429: "too_many_requests",
};

/** Bad input found after the schema check (e.g. a link someone else just took), with the same field codes. */
export class InvalidInputException extends Error {
  constructor(public readonly fields: Record<string, FormErrorCode>) {
    super("invalid input");
  }
}

/** A refusal with its own short code, e.g. 403 "plan_limit". */
export class AppException extends Error {
  constructor(
    public readonly status: number,
    public readonly code: "no_store" | "plan_limit" | "store_paused" | "not_accepting_orders" | "action_not_allowed" | "admin_not_configured" | "code_locked" | "store_closed" | "telegram_not_configured" | "bot_check_failed" | "backup_running" | "module_off",
  ) {
    super(code);
  }
}

export function toErrorResponse(error: unknown): { status: number; body: ErrorBody; headers?: Record<string, string> } {
  if (error instanceof RateLimitedException) {
    return { status: 429, body: { error: "too_many_requests" }, headers: { "Retry-After": String(error.retryAfterSeconds) } };
  }
  if (error instanceof AppException) {
    return { status: error.status, body: { error: error.code } };
  }
  if (error instanceof InvalidInputException) {
    return { status: 400, body: { error: "invalid_input", fields: error.fields } };
  }
  if (error instanceof ZodError) {
    return { status: 400, body: { error: "invalid_input", fields: toFieldErrors(error) } };
  }
  if (error instanceof HttpException) {
    const status = error.getStatus();
    // Anything without its own code is reported as an internal error, without its message.
    return { status, body: { error: CODE_BY_STATUS[status] ?? (status < 500 ? "bad_request" : "internal") } };
  }
  return { status: 500, body: { error: "internal" } };
}

interface JsonResponse {
  setHeader(name: string, value: string): void;
  status(code: number): { json(body: unknown): void };
}

/** Turns any thrown error into the shape above. Unexpected ones are logged and sent to Sentry; their details never reach the client. */
@Catch()
export class AllErrorsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(error: unknown, host: ArgumentsHost): void {
    const { status, body, headers } = toErrorResponse(error);
    if (status >= 500) {
      this.logger.error({ err: error }, "unexpected error");
      captureError(error);
    }
    const response = host.switchToHttp().getResponse<JsonResponse>();
    for (const [name, value] of Object.entries(headers ?? {})) response.setHeader(name, value);
    response.status(status).json(body);
  }
}
