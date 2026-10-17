/** 「2026年10月7日(水)」の形にする。年回忌の早見表で使う */
export function formatJaDate(date: Date): string {
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日(${weekday})`;
}

/** <input type="date"> の値(YYYY-MM-DD)を端末ローカルの日付にする。
 *  new Date("2026-10-01") はUTCとして解釈され、時差で前日になることがあるため使わない。 */
export function parseDateInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // 2月30日のような存在しない日付を弾く(Dateは繰り越してしまうため)
  if (date.getMonth() !== Number(m[2]) - 1 || date.getDate() !== Number(m[3])) return null;
  return date;
}
