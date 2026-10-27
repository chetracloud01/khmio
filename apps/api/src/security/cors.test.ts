import { describe, expect, it } from "vitest";
import { localFilesBaseUrl } from "../files/storage";
import { corsOrigin } from "./cors";

// A PC whose address changes with the Wi-Fi: development follows it; production never does.

const ask = (check: ReturnType<typeof corsOrigin>, origin: string | undefined) =>
  new Promise<boolean>((resolve) => {
    if (Array.isArray(check)) return resolve(origin !== undefined && check.includes(origin));
    check(origin, (_error, allow) => resolve(allow === true));
  });

describe("which pages may call the API", () => {
  it("in development, also any page on this PC or its local network", async () => {
    const check = corsOrigin({ NODE_ENV: "development", WEB_ORIGIN: ["http://192.168.40.39:3000"] });
    expect(await ask(check, "http://192.168.1.16:3000")).toBe(true);
    expect(await ask(check, "http://localhost:3000")).toBe(true);
    expect(await ask(check, "https://evil.example")).toBe(false);
  });

  it("in production, exactly WEB_ORIGIN", async () => {
    const check = corsOrigin({ NODE_ENV: "production", WEB_ORIGIN: ["https://khmio.com"] });
    expect(await ask(check, "https://khmio.com")).toBe(true);
    expect(await ask(check, "http://192.168.1.16:3000")).toBe(false);
  });
});

describe("photo links on this machine's disk", () => {
  it("are same-site in development, whatever local address was saved", () => {
    expect(localFilesBaseUrl({ NODE_ENV: "development", FILES_PUBLIC_URL: "http://192.168.40.39:4000/files", PORT: 4000 })).toBe("/files");
    expect(localFilesBaseUrl({ NODE_ENV: "development", FILES_PUBLIC_URL: undefined, PORT: 4000 })).toBe("/files");
  });

  it("keep a real domain (a tunnel), and full addresses outside development", () => {
    expect(localFilesBaseUrl({ NODE_ENV: "development", FILES_PUBLIC_URL: "https://dev.example.com/files/", PORT: 4000 })).toBe("https://dev.example.com/files");
    expect(localFilesBaseUrl({ NODE_ENV: "test", FILES_PUBLIC_URL: undefined, PORT: 4105 })).toBe("http://localhost:4105/files");
  });
});
