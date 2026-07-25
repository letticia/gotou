import { describe, expect, it } from "vitest";
import { formatBytes } from "./formatBytes";

describe("formatBytes", () => {
  it("formats small byte counts as B", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  it("formats KB-range values", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });

  it("formats MB-range values", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
