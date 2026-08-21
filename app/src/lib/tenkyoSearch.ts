// 逆引き典拠検索の照合ロジック(docs/tenkyo-spec.md B-2)。
// DBに直接依存させず検索関数を引数で受け取るので、実DBなしでテストできる。

import type { GongyoPreset, GongyoUnit } from "./gongyo";
import type { SearchRow } from "./db";
import { normalizeSearchInput } from "./variants";

/** 1項目あたりの上限。1つの句で辞書全体が埋まらないようにする */
const DICTIONARY_LIMIT_PER_CLAUSE = 30;

export interface DictionaryHit {
  id: number;
  title: string;
  reading: string;
  /** この項目に一致した句の数。多いほど確度が高い */
  matchedClauses: number;
}

export interface GongyoHit {
  unitId: string;
  unitTitle: string;
  lineIndex: number;
  lineText: string;
  lineRuby?: string;
  /** この偈文を収録している差定の名前(どのおつとめで読むか分かるように) */
  presetNames: string[];
}

/**
 * 各句について「原文そのまま」と「異体字を正規化した形」の2通りで辞書本文を引き、
 * 和集合を取る(docs/tenkyo-spec.md B-2)。一致した句数が多い順に並べる。
 */
export function searchDictionaryByClauses(
  clauses: string[],
  search: (needle: string, limit: number) => SearchRow[],
): DictionaryHit[] {
  const hits = new Map<number, DictionaryHit>();

  for (const clause of clauses) {
    // 同じ句で2通り引くため、同一句のなかでは項目を1回だけ数える
    const seenInClause = new Set<number>();
    const normalized = normalizeSearchInput(clause);
    const needles = normalized === clause ? [clause] : [clause, normalized];

    for (const needle of needles) {
      for (const row of search(needle, DICTIONARY_LIMIT_PER_CLAUSE)) {
        if (seenInClause.has(row.id)) continue;
        seenInClause.add(row.id);

        const existing = hits.get(row.id);
        if (existing) {
          existing.matchedClauses += 1;
        } else {
          hits.set(row.id, { ...row, matchedClauses: 1 });
        }
      }
    }
  }

  return [...hits.values()].sort(
    (a, b) => b.matchedClauses - a.matchedClauses || a.title.localeCompare(b.title, "ja"),
  );
}

/** その偈文を収録している差定名を preset.items から逆引きする */
function presetNamesForUnit(unitId: string, presets: Map<string, GongyoPreset>): string[] {
  const names: string[] = [];
  for (const preset of presets.values()) {
    if (preset.items.some((item) => item.unit === unitId)) names.push(preset.name);
  }
  return names;
}

/**
 * 勤行テキスト(30件程度)を全件走査して一致する行を探す。
 *
 * 双方向で照合する:
 * - 句が行に含まれる … 利用者が長い一節を貼り、その一部が偈文と一致する場合
 * - 行が入力に含まれる … 偈文の1行がまるごと入力に収まっている場合(偈文は短いのでよくある)
 *
 * text と ruby の両方を対象にするので、かなで入力された場合にも当たる。
 */
export function searchGongyoByClauses(
  input: string,
  clauses: string[],
  units: Map<string, GongyoUnit>,
  presets: Map<string, GongyoPreset>,
): GongyoHit[] {
  if (!input.trim() && clauses.length === 0) return [];

  const hits: GongyoHit[] = [];
  const presetNameCache = new Map<string, string[]>();

  for (const unit of units.values()) {
    unit.body.forEach((item, lineIndex) => {
      const candidates = [item.text, item.ruby].filter((v): v is string => Boolean(v));
      const matched = candidates.some(
        (value) =>
          clauses.some((clause) => value.includes(clause)) ||
          (value.length >= 4 && input.includes(value)),
      );
      if (!matched) return;

      if (!presetNameCache.has(unit.id)) {
        presetNameCache.set(unit.id, presetNamesForUnit(unit.id, presets));
      }
      hits.push({
        unitId: unit.id,
        unitTitle: unit.title,
        lineIndex,
        lineText: item.text,
        lineRuby: item.ruby,
        presetNames: presetNameCache.get(unit.id) ?? [],
      });
    });
  }

  return hits;
}
