import { describe, expect, it } from "vitest";
import { loadGongyoPresets } from "./gongyo";
import type { GongyoPreset } from "./gongyo";
import { groupBuiltinPresets } from "./presetGroups";

function preset(id: string, audience?: GongyoPreset["audience"]): GongyoPreset {
  return { version: 1, id, name: id, audience, items: [{ unit: "junen" }] };
}

describe("groupBuiltinPresets", () => {
  const presets = [
    preset("nichijo"),
    preset("tanagyo", "priest"),
    preset("junen-only", "dev"),
  ];

  it("puts presets without an audience in the general group", () => {
    expect(groupBuiltinPresets(presets, false).general.map((p) => p.id)).toEqual(["nichijo"]);
  });

  it("separates the ones meant for priests", () => {
    expect(groupBuiltinPresets(presets, false).priest.map((p) => p.id)).toEqual(["tanagyo"]);
  });

  it("hides the development-only presets in production", () => {
    const groups = groupBuiltinPresets(presets, false);
    expect(groups.dev).toEqual([]);
    const all = [...groups.general, ...groups.priest].map((p) => p.id);
    expect(all).not.toContain("junen-only");
  });

  it("shows them while developing", () => {
    expect(groupBuiltinPresets(presets, true).dev.map((p) => p.id)).toEqual(["junen-only"]);
  });
});

describe("the bundled presets", () => {
  const groups = groupBuiltinPresets([...loadGongyoPresets().values()], false);

  it("offer only the daily services to everyone", () => {
    for (const p of groups.general) {
      expect(p.id.startsWith("nichijo-gongyo"), p.id).toBe(true);
    }
    expect(groups.general.length).toBe(4);
  });

  it("list the 棚経 under priests", () => {
    expect(groups.priest.map((p) => p.id).sort()).toEqual([
      "tanagyo-senzo-daidai",
      "tanagyo-shinbo",
    ]);
  });

  it("keep 十念のみ out of the production list", () => {
    const visible = [...groups.general, ...groups.priest].map((p) => p.id);
    expect(visible).not.toContain("junen-only");
  });
});
