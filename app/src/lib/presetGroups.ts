import type { GongyoPreset } from "./gongyo";

/**
 * 差定選択の一覧で、雛形を対象ごとに分ける。
 *
 * 檀信徒が開いたときに最初に目にするのは一般向けの雛形だけにし、
 * 僧侶が檀家宅などで読むもの(棚経など)は下に分けて置く。
 * 動作確認用(audience: "dev")は開発中だけ見せる。
 */
export interface PresetGroups {
  general: GongyoPreset[];
  priest: GongyoPreset[];
  dev: GongyoPreset[];
}

export function groupBuiltinPresets(
  presets: GongyoPreset[],
  includeDev: boolean,
): PresetGroups {
  const groups: PresetGroups = { general: [], priest: [], dev: [] };
  for (const preset of presets) {
    if (preset.audience === "priest") groups.priest.push(preset);
    else if (preset.audience === "dev") {
      if (includeDev) groups.dev.push(preset);
    } else groups.general.push(preset);
  }
  return groups;
}
