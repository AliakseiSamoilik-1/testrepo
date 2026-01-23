import { describe, expect, it } from "vitest";

import { handler } from "../src/handler";

describe("handler", () => {
  it("returns OK", async () => {
    const res = await handler();
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("OK");
  });
});