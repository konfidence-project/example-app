// Calendar arithmetic in a configured time zone, without a date library.
// A DateKey is a calendar date, YYYY-MM-DD. Calendar dates are formatted in
// UTC, instants in the app's time zone.

export type DateKey = string;

const pad = (n: number) => String(n).padStart(2, "0");
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function zonedParts(date: Date, timeZone: string) {
  let format = partsFormatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    partsFormatters.set(timeZone, format);
  }
  const p = Object.fromEntries(format.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

/** A real calendar date as YYYY-MM-DD. 2026-02-30 fails: it would roll over to March. */
export const isDateKey = (value: unknown): value is DateKey => {
  if (typeof value !== "string" || !DATE_KEY.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

export const isTime = (value: unknown): value is string =>
  typeof value === "string" && TIME.test(value);

/** Calendar date of an instant in a time zone. */
export function dateKey(date: Date, timeZone: string): DateKey {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Wall clock time of an instant in a time zone, HH:MM. */
export function timeOfDay(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

const keyToUtc = (key: DateKey) => new Date(`${key}T00:00:00Z`);

export function addDays(key: DateKey, days: number): DateKey {
  const d = keyToUtc(key);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The Monday of the week that contains key. */
export function weekStartOf(key: DateKey): DateKey {
  const weekday = keyToUtc(key).getUTCDay(); // 0 is Sunday
  return addDays(key, -((weekday + 6) % 7));
}

/** The instant at which the wall clock in timeZone shows key and time (HH:MM). */
export function zonedToUtc(key: DateKey, time: string, timeZone: string): Date {
  const [y = 0, m = 1, d = 1] = key.split("-").map(Number);
  const [hh = 0, mm = 0] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  const offsetAt = (instant: number) => {
    const p = zonedParts(new Date(instant), timeZone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instant;
  };
  const first = wall - offsetAt(wall);
  // A second pass settles instants next to a daylight saving change.
  return new Date(wall - offsetAt(first));
}

const utcFormat = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options });

const weekdayLong = utcFormat({ weekday: "long" });
const weekdayShort = utcFormat({ weekday: "short" });
const monthShort = utcFormat({ month: "short" });

/** Wednesday */
export const formatWeekday = (key: DateKey) => weekdayLong.format(keyToUtc(key));

/** Nov 18 */
export const formatMonthDay = (key: DateKey) =>
  `${monthShort.format(keyToUtc(key))} ${Number(key.slice(8, 10))}`;

/** Wed, Nov 18 */
export const formatShortDate = (key: DateKey) =>
  `${weekdayShort.format(keyToUtc(key))}, ${formatMonthDay(key)}`;

/** Nov 17, 2026 */
export const formatLongDate = (key: DateKey) => `${formatMonthDay(key)}, ${key.slice(0, 4)}`;

/** 18 Nov */
export const formatDayMonth = (key: DateKey) =>
  `${Number(key.slice(8, 10))} ${monthShort.format(keyToUtc(key))}`;

/** Nov 16 – 22, 2026, or Nov 30 – Dec 6, 2026, or Dec 28, 2026 – Jan 3, 2027 */
export function formatWeekRange(start: DateKey): string {
  const end = addDays(start, 6);
  const [sy, sm] = [start.slice(0, 4), start.slice(5, 7)];
  const [ey, em] = [end.slice(0, 4), end.slice(5, 7)];
  if (sy !== ey) return `${formatLongDate(start)} – ${formatLongDate(end)}`;
  if (sm !== em) return `${formatMonthDay(start)} – ${formatMonthDay(end)}, ${ey}`;
  return `${formatMonthDay(start)} – ${Number(end.slice(8, 10))}, ${ey}`;
}

/** Today, Tomorrow, Yesterday, or the weekday. */
export function relativeDayLabel(key: DateKey, today: DateKey): string {
  if (key === today) return "Today";
  if (key === addDays(today, 1)) return "Tomorrow";
  if (key === addDays(today, -1)) return "Yesterday";
  return formatWeekday(key);
}

/** Nov 17, 09:12 in the given time zone. */
export function formatDateTime(date: Date, timeZone: string): string {
  return `${formatMonthDay(dateKey(date, timeZone))}, ${timeOfDay(date, timeZone)}`;
}
