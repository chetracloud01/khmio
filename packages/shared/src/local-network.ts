// Development only: the app on a PC whose network address changes with the
// Wi-Fi. A local address — this machine or a home/office network — may be
// swapped for the address the page was opened with, so a new Wi-Fi needs no
// settings change. Real domain names are never touched, and production
// doesn't use any of this (its addresses are fixed https domains).
// (No URL class here: every package compiles this file, some without DOM or Node types.)

/** This machine (localhost, 127.x, ::1) or a private network (10.x, 172.16–31.x, 192.168.x, *.local). */
export function isLocalNetworkHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "::1" || host.endsWith(".local")) return true;
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  // Four parts were checked just above; the defaults only satisfy the type.
  const [a = -1, b = -1] = parts;
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

interface Address {
  protocol: string;
  hostname: string;
  port: string;
  path: string;
}

/** "http://192.168.1.16:4000/files" → its parts; null when it isn't an http(s) address. */
function parseAddress(address: string): Address | null {
  const match = /^(https?:)\/\/(\[[^\]]+\]|[^/:?#]+)(?::(\d+))?(\/[^?#]*)?$/i.exec(address.trim());
  if (!match) return null;
  return { protocol: match[1]!.toLowerCase(), hostname: match[2]!.replace(/^\[|\]$/g, ""), port: match[3] ?? "", path: (match[4] ?? "").replace(/\/$/, "") };
}

/** "http://192.168.1.16:3000" → true; "https://khmio.com" → false; anything unreadable → false. */
export function isLocalNetworkOrigin(origin: string): boolean {
  const address = parseAddress(origin);
  return address !== null && isLocalNetworkHost(address.hostname);
}

/**
 * The API address a page should use in development: when both the saved
 * address and the page's own address are local, the API on the page's
 * address (same port as saved). Otherwise the saved address, unchanged.
 */
export function followLocalAddress(saved: string, page: { protocol: string; hostname: string }): string {
  const address = parseAddress(saved);
  if (!address || !isLocalNetworkHost(address.hostname) || !isLocalNetworkHost(page.hostname)) return saved;
  const host = page.hostname.includes(":") ? `[${page.hostname}]` : page.hostname;
  return `${page.protocol}//${host}${address.port ? `:${address.port}` : ""}${address.path}`;
}
