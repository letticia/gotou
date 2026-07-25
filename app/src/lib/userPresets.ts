import type { GongyoPreset, GongyoPresetItem } from "./gongyo";

const STORAGE_KEY = "gotou:user-presets";
const LAST_PRESET_KEY = "gotou:last-preset-id";

/** 雛形プリセットを複製し、ユーザー編集用の新しいプリセットを作る(元のitemsは変更しない) */
export function duplicatePreset(source: GongyoPreset, newId: string, newName: string): GongyoPreset {
  return {
    version: source.version,
    id: newId,
    name: newName,
    items: source.items.map((item) => ({ ...item })),
  };
}

/** items[fromIndex]をitems[toIndex]の位置に移動する(範囲外は元の配列をそのまま返す) */
export function reorderItems(
  items: GongyoPresetItem[],
  fromIndex: number,
  toIndex: number,
): GongyoPresetItem[] {
  if (
    fromIndex < 0 ||
    fromIndex >= items.length ||
    toIndex < 0 ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items;
  }
  const next = items.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/** items[index]のenabledを反転する(省略時はtrue扱いなのでfalseへ切り替える) */
export function toggleItemEnabled(items: GongyoPresetItem[], index: number): GongyoPresetItem[] {
  return items.map((item, i) =>
    i === index ? { ...item, enabled: item.enabled === false } : item,
  );
}

/** items[index]のcounterを設定する。undefinedを渡すとカウンター無し(フィールド自体を削除)にする */
export function setItemCounter(
  items: GongyoPresetItem[],
  index: number,
  counter: number | undefined,
): GongyoPresetItem[] {
  return items.map((item, i) => {
    if (i !== index) return item;
    if (counter === undefined) {
      const { counter: _drop, ...rest } = item;
      return rest;
    }
    return { ...item, counter };
  });
}

export function generateUserPresetId(): string {
  return `user-${crypto.randomUUID()}`;
}

/** localStorageからユーザー差定一覧を読む(壊れたJSON・非対応環境では空配列) */
export function loadUserPresets(): GongyoPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** idが一致するものは上書き、無ければ追加する */
export function saveUserPreset(preset: GongyoPreset): void {
  const presets = loadUserPresets();
  const index = presets.findIndex((p) => p.id === preset.id);
  if (index === -1) {
    presets.push(preset);
  } else {
    presets[index] = preset;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function deleteUserPreset(id: string): void {
  const presets = loadUserPresets().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function loadLastPresetId(): string | null {
  return localStorage.getItem(LAST_PRESET_KEY);
}

export function saveLastPresetId(id: string): void {
  localStorage.setItem(LAST_PRESET_KEY, id);
}
