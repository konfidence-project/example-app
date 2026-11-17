// Date handling in the viewer's time zone. Server and browser format with the same zone (from the tz cookie), so
// server-rendered markup hydrates without mismatches.

export const DEFAULT_TZ = "UTC";

export function validTz(tz: string | undefined): string {
  if (!tz) return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TZ;
  }
}

function parts(date: Date, tz: string): Record<string, number> {
  const out: Record<string, number> = {};
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  for (const p of fmt.formatToParts(date)) if (p.type !== "literal") out[p.type] = Number(p.value);
  return out;
}

const pad = (n: number) => String(n).padStart(2, "0");

// dayKey is the calendar day (YYYY-MM-DD) an instant falls on in tz.
export function dayKey(iso: string | Date, tz: string): string {
  const p = parts(new Date(iso), tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function mondayOf(ymd: string): string {
  const dow = new Date(`${ymd}T00:00:00Z`).getUTCDay();
  return addDays(ymd, -((dow + 6) % 7));
}

export function isYmd(s: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

// zonedToUtc converts a wall-clock date and time in tz to an ISO instant.
export function zonedToUtc(ymd: string, hm: string, tz: string): string {
  const target = Date.parse(`${ymd}T${hm}:00Z`);
  let guess = target;
  // Two passes settle DST transitions: the offset at the guess can differ from the offset at the answer.
  for (let i = 0; i < 2; i++) {
    const p = parts(new Date(guess), tz);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    guess += target - asUtc;
  }
  return new Date(guess).toISOString();
}

export function fmtTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function fmtDay(ymd: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts }).format(new Date(`${ymd}T00:00:00Z`));
}

export function fmtShort(iso: string, tz: string): string {
  return `${new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(new Date(iso))} · ${fmtTime(iso, tz)}`;
}

export function relativeDay(ymd: string, today: string): string {
  if (ymd === today) return "Today";
  if (ymd === addDays(today, 1)) return "Tomorrow";
  if (ymd === addDays(today, -1)) return "Yesterday";
  return fmtDay(ymd, { weekday: "long" });
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "?";
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}
