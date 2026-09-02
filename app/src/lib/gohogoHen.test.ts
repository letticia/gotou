import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_GOHOGO_HEN, loadGohogoHen, saveGohogoHen } from "./gohogoHen";

function stubStorage(getItem: () => string | null, setItem: () => void = () => {}) {
  vi.stubGlobal("localStorage", { getItem, setItem } as unknown as Storage);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadGohogoHen", () => {
  it("defaults to 前篇 when nothing has been saved", () => {
    stubStorage(() => null);
    expect(loadGohogoHen()).toBe("zenpen");
    expect(DEFAULT_GOHOGO_HEN).toBe("zenpen");
  });

  it("returns the saved 篇", () => {
    stubStorage(() => "kohen");
    expect(loadGohogoHen()).toBe("kohen");
  });

  it("falls back to the default for an unrecognized stored value", () => {
    stubStorage(() => "chuhen");
    expect(loadGohogoHen()).toBe("zenpen");
  });

  it("falls back to the default when localStorage throws (private browsing etc.)", () => {
    stubStorage(() => {
      throw new Error("denied");
    });
    expect(loadGohogoHen()).toBe("zenpen");
  });
});

describe("saveGohogoHen", () => {
  it("writes the 篇 to localStorage", () => {
    const setItem = vi.fn();
    stubStorage(() => null, setItem);
    saveGohogoHen("kohen");
    expect(setItem).toHaveBeenCalledWith("gotou:gohogo-hen", "kohen");
  });

  it("does not throw when localStorage rejects the write", () => {
    stubStorage(
      () => null,
      () => {
        throw new Error("quota");
      },
    );
    expect(() => saveGohogoHen("kohen")).not.toThrow();
  });
});
