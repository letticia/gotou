import variantsData from "../shared/variants.json";

const variantsMap: Record<string, string> = (
  variantsData as { map: Record<string, string> }
).map;

/** shared/variants.json による正規化: NFKC正規化 → 異体字マップ適用 */
export function normalizeSearchInput(text: string): string {
  if (!text) return "";
  const nfkc = text.normalize("NFKC");
  let result = "";
  for (const ch of nfkc) {
    result += variantsMap[ch] ?? ch;
  }
  return result;
}
