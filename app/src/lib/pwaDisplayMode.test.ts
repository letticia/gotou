import { describe, expect, it } from "vitest";
import { isStandalonePwa } from "./pwaDisplayMode";

function fakeWindow(options: { displayModeStandalone: boolean; iosStandalone?: boolean }): Window {
  return {
    matchMedia: () => ({ matches: options.displayModeStandalone }) as MediaQueryList,
    navigator: { standalone: options.iosStandalone } as Navigator & { standalone?: boolean },
  } as unknown as Window;
}

describe("isStandalonePwa", () => {
  it("returns false when neither display-mode nor navigator.standalone indicate standalone", () => {
    expect(isStandalonePwa(fakeWindow({ displayModeStandalone: false }))).toBe(false);
  });

  it("returns true when the display-mode media query matches standalone", () => {
    expect(isStandalonePwa(fakeWindow({ displayModeStandalone: true }))).toBe(true);
  });

  it("returns true when navigator.standalone is true (iOS Safari)", () => {
    expect(
      isStandalonePwa(fakeWindow({ displayModeStandalone: false, iosStandalone: true })),
    ).toBe(true);
  });
});
