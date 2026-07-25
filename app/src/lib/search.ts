import { normalizeSearchInput } from "./variants";
import type { DummyEntry } from "./dummyEntries";

/**
 * 読み(reading)の前方一致を主役に、見出し語の正規化キー(searchKey)の前方一致も
 * ヒットに含める。shared/schema.sqlのidx_reading/idx_searchの二本立て設計に対応する。
 */
export function searchEntries(entries: DummyEntry[], rawQuery: string): DummyEntry[] {
  const query = normalizeSearchInput(rawQuery.trim());
  if (!query) return [];
  return entries.filter(
    (entry) => entry.reading.startsWith(query) || entry.searchKey.startsWith(query),
  );
}
