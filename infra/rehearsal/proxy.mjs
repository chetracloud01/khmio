// The rehearsal's front door (pnpm rehearsal): one address for everything,
// like production's domain, so the tunnel needs only one public URL and
// cookies work as they will live.
//   /api/*     → the API (prefix removed; production has it on api.<domain>)
//   /photos/*  → the local S3 bucket (production: R2 on files.<domain>)
//   anything else → the web app
import { createServer, request } from "node:http";

/** Starts the proxy; resolves with the server once it listens. */
export function startProxy({ port, apiPort, webPort, s3Url }) {
  const s3 = new URL(s3Url);
  const route = (path) => {
    if (path === "/api" || path.startsWith("/api/")) return { host: "127.0.0.1", port: apiPort, path: path.slice(4) || "/", api: true };
    if (path.startsWith("/photos/")) return { host: s3.hostname, port: Number(s3.port || 80), path: `${s3.pathname.replace(/\/$/, "")}/${path.slice(8)}` };
    return { host: "127.0.0.1", port: webPort, path };
  };
  const server = createServer((req, res) => forward(route(req.url ?? "/"), req, res));
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

function forward(target, req, res) {
  const forwardedFor = [req.headers["x-forwarded-for"], req.socket.remoteAddress].filter(Boolean).join(", ");
  const upstream = request(
    {
      host: target.host,
      port: target.port,
      path: target.path,
      method: req.method,
      headers: { ...req.headers, "x-forwarded-for": forwardedFor, "x-forwarded-proto": "https" },
    },
    (answer) => {
      const headers = { ...answer.headers };
      // The admin cookie is for /admin on the API's own address; here the API lives under /api.
      if (target.api && headers["set-cookie"]) headers["set-cookie"] = headers["set-cookie"].map((cookie) => cookie.replace(/Path=\/admin/i, "Path=/api/admin"));
      res.writeHead(answer.statusCode ?? 502, headers);
      answer.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("rehearsal proxy: that service isn't answering");
  });
  req.pipe(upstream);
}
