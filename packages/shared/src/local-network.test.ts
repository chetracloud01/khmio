import { describe, expect, it } from "vitest";
import { followLocalAddress, isLocalNetworkHost, isLocalNetworkOrigin } from "./local-network";

describe("local network addresses (development)", () => {
  it("knows this machine and private networks", () => {
    for (const host of ["localhost", "127.0.0.1", "::1", "[::1]", "10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.16", "my-pc.local"]) {
      expect(isLocalNetworkHost(host), host).toBe(true);
    }
  });

  it("never treats a public address or a domain as local", () => {
    for (const host of ["khmio.com", "api.khmio.com", "8.8.8.8", "172.32.0.1", "172.15.0.1", "192.169.1.1", "192.168.1", "localhost.evil.com", "10.0.0.256"]) {
      expect(isLocalNetworkHost(host), host).toBe(false);
    }
    expect(isLocalNetworkOrigin("https://khmio.com")).toBe(false);
    expect(isLocalNetworkOrigin("not a url")).toBe(false);
    expect(isLocalNetworkOrigin("http://192.168.1.16:3000")).toBe(true);
  });

  it("follows the page's address when the Wi-Fi changed", () => {
    expect(followLocalAddress("http://192.168.40.39:4000", { protocol: "http:", hostname: "192.168.1.16" })).toBe("http://192.168.1.16:4000");
    expect(followLocalAddress("http://localhost:4000", { protocol: "http:", hostname: "localhost" })).toBe("http://localhost:4000");
    expect(followLocalAddress("http://localhost:4000", { protocol: "http:", hostname: "10.0.0.7" })).toBe("http://10.0.0.7:4000");
  });

  it("leaves a real domain alone, and a local address opened from a domain", () => {
    expect(followLocalAddress("https://api.khmio.com", { protocol: "http:", hostname: "192.168.1.16" })).toBe("https://api.khmio.com");
    expect(followLocalAddress("http://192.168.40.39:4000", { protocol: "https:", hostname: "khmio.com" })).toBe("http://192.168.40.39:4000");
    expect(followLocalAddress("garbage", { protocol: "http:", hostname: "localhost" })).toBe("garbage");
  });
});
