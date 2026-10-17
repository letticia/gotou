/**
 * 年回忌の早見表。命日から中陰・百箇日・年回忌の日付を出す。
 *
 * 数え方は一般的なものに従う(開発者=僧侶の判断、2026-10):
 * - 中陰と百箇日は**命日を1日目**として数える(初七日=命日から6日後)。
 *   関西などで前日(逮夜)から数える地域差は扱わない。
 * - 年回忌は**亡くなった年を1として数える**(一周忌=満1年、三回忌=満2年、
 *   N回忌=満N-1年)。
 * - 載せる年回忌は 一周忌・三・七・十三・十七・二十三・二十七・三十三・五十回忌。
 *   二十五回忌は載せない(二十三・二十七を勤める側に合わせた)。
 *
 * 法要の日取りはお寺と相談して決めるものなので、ここで出すのは目安の日付だけ。
 */

export interface Memorial {
  label: string;
  date: Date;
  kind: "chuin" | "hyakkanichi" | "nenki";
}

/** 中陰(命日を1日目として7日ごと)。日数は命日に足す日数 */
const CHUIN: { label: string; offsetDays: number }[] = [
  { label: "初七日", offsetDays: 6 },
  { label: "二七日", offsetDays: 13 },
  { label: "三七日", offsetDays: 20 },
  { label: "四七日", offsetDays: 27 },
  { label: "五七日", offsetDays: 34 },
  { label: "六七日", offsetDays: 41 },
  { label: "四十九日(七七日)", offsetDays: 48 },
];

/** 年回忌と、命日からの満年数。一周忌は満1年、N回忌は満N-1年(三回忌=満2年) */
const NENKI: { label: string; years: number }[] = [
  { label: "一周忌", years: 1 },
  { label: "三回忌", years: 2 },
  { label: "七回忌", years: 6 },
  { label: "十三回忌", years: 12 },
  { label: "十七回忌", years: 16 },
  { label: "二十三回忌", years: 22 },
  { label: "二十七回忌", years: 26 },
  { label: "三十三回忌", years: 32 },
  { label: "五十回忌", years: 49 },
];

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * 命日の月日のまま年だけ進める。2月29日の命日は、うるう年でない年には
 * 2月28日とする(翌月の3月1日に繰り越さず、命日の月の中に留める)。
 */
function addYearsKeepingMonth(date: Date, years: number): Date {
  const year = date.getFullYear() + years;
  const month = date.getMonth();
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(date.getDate(), lastDayOfMonth));
}

export function listMemorials(deathDate: Date): Memorial[] {
  const base = new Date(deathDate.getFullYear(), deathDate.getMonth(), deathDate.getDate());
  return [
    ...CHUIN.map(({ label, offsetDays }) => ({
      label,
      date: addDays(base, offsetDays),
      kind: "chuin" as const,
    })),
    { label: "百箇日", date: addDays(base, 99), kind: "hyakkanichi" as const },
    ...NENKI.map(({ label, years }) => ({
      label,
      date: addYearsKeepingMonth(base, years),
      kind: "nenki" as const,
    })),
  ];
}

/** 今日以降で最も近い法要(無ければnull)。当日は「これから」に含める */
export function nextMemorial(memorials: Memorial[], today: Date): Memorial | null {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return memorials.find((m) => m.date.getTime() >= start.getTime()) ?? null;
}
