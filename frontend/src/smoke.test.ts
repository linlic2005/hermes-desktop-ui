import { describe, expect, it } from "vitest";

describe("frontend test harness", () => {
  it("runs unit tests", () => {
    expect("Hermes Desktop UI").toContain("Hermes");
  });
});
