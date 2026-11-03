import { PITT_TZ } from "./time";

function stamp(date: string, min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${date.replaceAll("-", "")}T${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
}

// iCalendar text escaping: backslash, semicolon, comma and newlines.
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// A calendar event for a free stretch in a room, so a student can block the time.
// It is a personal reminder, not a booking, and says so.
export function studyEventIcs(opts: {
  roomId: string;
  title: string;
  location: string;
  date: string; // YYYY-MM-DD, Pittsburgh time
  startMin: number;
  endMin: number;
  url: string;
  now?: Date;
}): string {
  const end = Math.min(opts.endMin, 24 * 60 - 1);
  const dtstamp = (opts.now ?? new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Open Pitt Rooms//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${opts.roomId}-${stamp(opts.date, opts.startMin)}@openpittrooms`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=${PITT_TZ}:${stamp(opts.date, opts.startMin)}`,
    `DTEND;TZID=${PITT_TZ}:${stamp(opts.date, end)}`,
    `SUMMARY:${esc(`Study · ${opts.title}`)}`,
    `LOCATION:${esc(opts.location)}`,
    `DESCRIPTION:${esc(`No class scheduled on Pitt's 25Live calendar for this time. This is not a reservation; confirm before you go: ${opts.url}`)}`,
    `URL:${opts.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
