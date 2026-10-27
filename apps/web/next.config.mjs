import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const originOf = (url) => {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
};

/**
 * Security headers for every page (production builds only: the dev server
 * needs eval for hot reload). The page may talk to the API and load photos
 * from it (or from NEXT_PUBLIC_FILES_ORIGIN, e.g. Cloudflare R2), Telegram's
 * login button and Cloudflare Turnstile — nothing else. No site may frame
 * these pages. Inline scripts are allowed because Next.js needs them
 * without per-request nonces.
 */
function securityHeaders() {
  const api = originOf(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");
  const files = originOf(process.env.NEXT_PUBLIC_FILES_ORIGIN ?? "");
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://telegram.org https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${api} ${files}`.trim(),
    "font-src 'self' data:",
    `connect-src 'self' ${api}`,
    "frame-src https://oauth.telegram.org https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "worker-src 'self'",
    "manifest-src 'self'",
  ].join("; ");
  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  ];
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@khmio/shared", "@khmio/ui"],
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    return [{ source: "/:path*", headers: securityHeaders() }];
  },
  /**
   * Development: photos on this PC's disk get same-site links (/files/…, see
   * apps/api files/storage.ts), passed through to the API on this machine — so
   * they show whatever address the site was opened with. Production photos come
   * from Cloudflare R2 at their own address and never use this.
   */
  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];
    let port = "4000";
    try {
      port = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").port || "80";
    } catch {}
    return [{ source: "/files/:path*", destination: `http://localhost:${port}/files/:path*` }];
  },
};

export default withNextIntl(nextConfig);
