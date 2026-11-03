// All times in this app are Pittsburgh local time, regardless of where the server or
// viewer is. Internally we use "YYYY-MM-DD" date strings and minutes since local midnight.

export const PITT_TZ = "America/New_York";
export const MINUTES_PER_DAY = 1440;

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PITT_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function partsInPittTz(date: Date) {
  const parts = Object.fromEntries(partsFormatter.formatToParts(date).map((p) => [p.type, p.value]));
  return parts as Record<"year" | "month" | "day" | "hour" | "minute", string>;
}

export function pittDateISO(date: Date = new Date()): string {
  const p = partsInPittTz(date);
  return `${p.year}-${p.month}-${p.day}`;
}

export function pittMinutesOfDay(date: Date = new Date()): number {
  const p = partsInPittTz(date);
  // Some Intl implementations report midnight as hour "24".
  return (Number(p.hour) % 24) * 60 + Number(p.minute);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isISODate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function isHHMM(s: string): boolean {
  return TIME_RE.test(s);
}

export function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function toHHMM(mins: number): string {
  const m = ((mins % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// Calendar-day arithmetic on "YYYY-MM-DD" strings (noon UTC avoids DST edges).
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatClock(mins: number): string {
  const m = ((mins % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  if (mins >= MINUTES_PER_DAY) return "midnight";
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return mm === 0 ? `${h12} ${suffix}` : `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
}

export function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export function dayLabel(iso: string, today: string): string {
  if (iso === today) return "Today";
  if (iso === addDays(today, 1)) return "Tomorrow";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
