import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Security headers on every API answer. The API serves JSON and photos
 * only: nothing to run, nothing to frame. HSTS only in production (https).
 */
export function securityHeaders(production: boolean) {
  return (_req: IncomingMessage, res: ServerResponse, next: () => void) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    res.setHeader("Referrer-Policy", "no-referrer");
    // Photos are shown by the web app, on another origin.
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    if (production) res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
    next();
  };
}
