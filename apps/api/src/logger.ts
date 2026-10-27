import type { IncomingMessage, ServerResponse } from "node:http";
import pino, { type Logger } from "pino";
import pinoHttp from "pino-http";

/**
 * Never logged, wherever they appear: login headers and cookies, and any
 * field that carries a phone number, a secret or a payment key (CLAUDE.md:
 * "Never print, log or commit secrets").
 */
export const REDACTED_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
  "*.phone",
  "*.password",
  "*.token",
  "*.secret",
  "*.apiKey",
  "*.bakongId",
];

export function createLogger(level: string): Logger {
  return pino({ level, redact: { paths: REDACTED_PATHS, censor: "[redacted]" } });
}

/**
 * The request line without its query string — a query can carry a phone
 * number or a token — and without a buyer's order token: that token alone
 * opens the order page (name, phone, address), so it never reaches a log.
 */
export function requestPath(url: string | undefined): string {
  return ((url ?? "").split("?")[0] ?? "").replace(/\/public\/orders\/[^/]+/, "/public/orders/:token");
}

/** One log line per request: method, path, status and time — no headers, body or query. */
export function httpLogger(logger: Logger) {
  return pinoHttp({
    logger,
    serializers: {
      req: (req: IncomingMessage) => ({ method: req.method, path: requestPath(req.url) }),
      res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
      // pino-http makes up an error (with a stack) for every 5xx; real errors are logged once by AllErrorsFilter.
      err: () => undefined,
    },
    customLogLevel: (_req, res) => (res.statusCode >= 500 ? "warn" : "info"),
  });
}
