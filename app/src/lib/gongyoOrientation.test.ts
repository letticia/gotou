import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ORIENTATION,
  loadOrientation,
  saveOrientation,
  toggleOrientation,
} from "./gongyoOrientation";

function stubStorage(getItem: () => string | null, setItem: () => void = () => {}) {
  vi.stubGlobal("localStorage", { getItem, setItem } as unknown as Storage);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadOrientation", () => {
  it("defaults to vertical when nothing has been saved", () => {
    stubStorage(() => null);
    expect(loadOrientation()).toBe("vertical");
    expect(DEFAULT_ORIENTATION).toBe("vertical");
  });

  it("returns the saved orientation", () => {
    stubStorage(() => "horizontal");
    expect(loadOrientation()).toBe("horizontal");
  });

  it("falls back to the default for an unrecognized stored value", () => {
    stubStorage(() => "sideways");
    expect(loadOrientation()).toBe("vertical");
  });

  it("falls back to the default when localStorage throws (private browsing etc.)", () => {
    stubStorage(() => {
      throw new Error("denied");
    });
    expect(loadOrientation()).toBe("vertical");
  });
});

describe("saveOrientation", () => {
  it("writes the orientation to localStorage", () => {
    const setItem = vi.fn();
    stubStorage(() => null, setItem);
    saveOrientation("horizontal");
    expect(setItem).toHaveBeenCalledWith("gotou:gongyo-orientation", "horizontal");
  });

  it("does not throw when localStorage rejects the write", () => {
    stubStorage(
      () => null,
      () => {
        throw new Error("quota");
      },
    );
    expect(() => saveOrientation("vertical")).not.toThrow();
  });
});

describe("toggleOrientation", () => {
  it("flips between vertical and horizontal", () => {
    expect(toggleOrientation("vertical")).toBe("horizontal");
    expect(toggleOrientation("horizontal")).toBe("vertical");
  });
});
