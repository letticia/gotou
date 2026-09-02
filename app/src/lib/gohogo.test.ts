import { describe, expect, it } from "vitest";
import {
  GOHOGO_DAILY_UNIT_ID,
  chapterNumberForDate,
  chapterToKanji,
  formatGohogoIntroLabel,
  formatGohogoUnitTitle,
  getDailyGohogo,
  getGohogoChapter,
  presetUsesDailyGohogo,
  withDailyGohogo,
} from "./gohogo";
import type { GongyoPreset, GongyoUnit } from "./gongyo";

/** ローカル日付で作る(chapterNumberForDateは端末ローカルの「日」を見る) */
function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

describe("chapterToKanji", () => {
  it.each([
    [1, "一"], [9, "九"], [10, "十"], [11, "十一"],
    [20, "二十"], [21, "二十一"], [30, "三十"], [31, "三十一"],
  ])("%i -> %s", (n, expected) => {
    expect(chapterToKanji(n)).toBe(expected);
  });
});

describe("chapterNumberForDate", () => {
  it("uses the day of the month as the chapter number", () => {
    expect(chapterNumberForDate(localDate(2026, 9, 1))).toBe(1);
    expect(chapterNumberForDate(localDate(2026, 9, 3))).toBe(3);
    expect(chapterNumberForDate(localDate(2026, 9, 28))).toBe(28);
  });

  it("reaches 30 only in months that have a 30th", () => {
    // 9月は30日まで。第31章はこの月には出ない
    expect(chapterNumberForDate(localDate(2026, 9, 30))).toBe(30);
  });

  it("reaches 31 in a 31-day month", () => {
    expect(chapterNumberForDate(localDate(2026, 10, 31))).toBe(31);
  });

  it("stops at 28 in a non-leap February", () => {
    // 2026年2月は28日まで。第29〜31章はこの月には出ない
    expect(chapterNumberForDate(localDate(2026, 2, 28))).toBe(28);
  });

  it("reaches 29 in a leap February", () => {
    expect(chapterNumberForDate(localDate(2028, 2, 29))).toBe(29);
  });

  it("rolls over at the change of month", () => {
    expect(chapterNumberForDate(localDate(2026, 9, 30))).toBe(30);
    expect(chapterNumberForDate(localDate(2026, 10, 1))).toBe(1);
  });
});

describe("getGohogoChapter", () => {
  it("has all 31 chapters in both 篇", () => {
    for (const hen of ["zenpen", "kohen"] as const) {
      for (let n = 1; n <= 31; n++) {
        expect(getGohogoChapter(hen, n), `${hen} 第${n}章`).not.toBeNull();
      }
    }
  });

  it("returns null outside the chapter range", () => {
    expect(getGohogoChapter("zenpen", 0)).toBeNull();
    expect(getGohogoChapter("zenpen", 32)).toBeNull();
  });

  it("keeps text paired with a kana reading", () => {
    const chapter = getGohogoChapter("zenpen", 30);
    expect(chapter).not.toBeNull();
    for (const clause of chapter!.body) {
      expect(clause.text.length).toBeGreaterThan(0);
      expect(clause.ruby.length).toBeGreaterThan(0);
      expect(clause.ruby).not.toMatch(/[一-鿿]/);
    }
  });
});

describe("getDailyGohogo", () => {
  it("builds a unit for the day's chapter", () => {
    const unit = getDailyGohogo(localDate(2026, 9, 30), "zenpen");
    expect(unit).not.toBeNull();
    expect(unit!.id).toBe("gohogo-zenpen-30");
    expect(unit!.title).toBe("御法語（前篇三十　一期勧化）");
    expect(unit!.reading).toBe("いちごかんげ");
    expect(unit!.paginated).toBe(true);
    expect(unit!.body.length).toBeGreaterThan(0);
    expect(unit!.source?.license).toBe("PD");
  });

  it("follows the 篇 setting", () => {
    const zen = getDailyGohogo(localDate(2026, 9, 3), "zenpen");
    const ko = getDailyGohogo(localDate(2026, 9, 3), "kohen");
    expect(zen!.id).toBe("gohogo-zenpen-3");
    expect(ko!.id).toBe("gohogo-kohen-3");
    expect(zen!.title).not.toBe(ko!.title);
  });

  it("gives a different chapter on a different day", () => {
    const a = getDailyGohogo(localDate(2026, 9, 3), "zenpen");
    const b = getDailyGohogo(localDate(2026, 9, 4), "zenpen");
    expect(a!.id).not.toBe(b!.id);
  });

  it("gives the same chapter on the same day of a different month", () => {
    const a = getDailyGohogo(localDate(2026, 9, 3), "zenpen");
    const b = getDailyGohogo(localDate(2027, 1, 3), "zenpen");
    expect(a!.id).toBe(b!.id);
  });

  it("resolves for every day a month can have", () => {
    for (let day = 1; day <= 31; day++) {
      expect(getDailyGohogo(localDate(2026, 10, day), "kohen"), `${day}日`).not.toBeNull();
    }
  });
});

describe("formatting", () => {
  it("names the unit with 篇・章・章題", () => {
    const chapter = getGohogoChapter("kohen", 1)!;
    expect(formatGohogoUnitTitle("kohen", chapter)).toBe("御法語（後篇一　難易二道）");
  });

  it("writes the door label as one line", () => {
    const chapter = getGohogoChapter("kohen", 1)!;
    expect(formatGohogoIntroLabel("kohen", chapter)).toBe("本日の御法語: 後篇第一章 難易二道");
  });
});

describe("withDailyGohogo", () => {
  const dummy: GongyoUnit = {
    id: "koge", title: "香偈", reading: "こうげ", body: [{ text: "香偈" }],
  };

  it("adds the day's chapter under the id presets refer to", () => {
    const units = withDailyGohogo(new Map([["koge", dummy]]), localDate(2026, 9, 30), "zenpen");
    const daily = units.get(GOHOGO_DAILY_UNIT_ID);
    expect(daily?.title).toBe("御法語（前篇三十　一期勧化）");
    // 元の表は書き換えない
    expect(units.get("koge")).toBe(dummy);
  });

  it("does not mutate the map it was given", () => {
    const original = new Map([["koge", dummy]]);
    withDailyGohogo(original, localDate(2026, 9, 30), "zenpen");
    expect(original.has(GOHOGO_DAILY_UNIT_ID)).toBe(false);
  });
});

describe("presetUsesDailyGohogo", () => {
  function preset(items: GongyoPreset["items"]): GongyoPreset {
    return { version: 1, id: "p", name: "テスト", items };
  }

  it("is true when the preset refers to the daily unit", () => {
    expect(presetUsesDailyGohogo(preset([{ unit: "koge" }, { unit: GOHOGO_DAILY_UNIT_ID }])))
      .toBe(true);
  });

  it("is false for a preset without it", () => {
    expect(presetUsesDailyGohogo(preset([{ unit: "koge" }]))).toBe(false);
  });

  it("ignores it when the item is switched off", () => {
    expect(presetUsesDailyGohogo(
      preset([{ unit: GOHOGO_DAILY_UNIT_ID, enabled: false }]),
    )).toBe(false);
  });
});
