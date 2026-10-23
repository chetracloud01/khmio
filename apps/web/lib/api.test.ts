import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { api, ApiError, apiSend } from "./api";

const answer = (status: number, body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

const thing = z.object({ id: z.string(), count: z.number() });

describe("api()", () => {
  beforeEach(() => {
    // The shape check names what differs in development; keep the test output quiet.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns the answer read with its schema, extra fields dropped", async () => {
    vi.stubGlobal("fetch", answer(200, { id: "a1", count: 3, internalNote: "x" }));
    await expect(api("/things/a1", thing)).resolves.toEqual({ id: "a1", count: 3 });
  });

  it("refuses an answer of another shape as bad_answer, never handing it to the screen", async () => {
    vi.stubGlobal("fetch", answer(200, { id: "a1" }));
    await expect(api("/things/a1", thing)).rejects.toMatchObject({ name: "ApiError", status: 200, code: "bad_answer" });
  });

  it("turns the API's error shape into an ApiError with its code and field codes", async () => {
    vi.stubGlobal("fetch", answer(400, { error: "invalid_input", fields: { name: "too_short" } }));
    await expect(apiSend("/things", { method: "POST", body: {} })).rejects.toMatchObject({ status: 400, code: "invalid_input", fields: { name: "too_short" } });
  });

  it("reads an error body it doesn't recognise as internal", async () => {
    vi.stubGlobal("fetch", answer(502, "<html>Bad gateway</html>"));
    await expect(apiSend("/things")).rejects.toMatchObject({ status: 502, code: "internal", fields: {} });
  });

  it("is unreachable (status 0) when the request can't be made", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const failure = await apiSend("/things").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status: 0, code: "unreachable" });
  });
});
