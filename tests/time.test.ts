import { describe, expect, it } from "vitest";
import {
  addDays,
  dayLabel,
  formatClock,
  formatDuration,
  isHHMM,
  isISODate,
  parseHHMM,
  pittDateISO,
  pittMinutesOfDay,
  toHHMM,
} from "@/lib/time";

describe("Pitt-local time", () => {
  it("uses Eastern time, not the server's zone", () => {
    // 03:30 UTC on Nov 4 is still Nov 3 in Pittsburgh (EST, UTC-5).
    const instant = new Date("2026-11-04T03:30:00Z");
    expect(pittDateISO(instant)).toBe("2026-11-03");
    expect(pittMinutesOfDay(instant)).toBe(22 * 60 + 30);
  });

  it("handles daylight saving time", () => {
    // July is EDT (UTC-4).
    expect(pittMinutesOfDay(new Date("2026-07-01T16:00:00Z"))).toBe(12 * 60);
  });

  it("reports midnight as minute 0", () => {
    expect(pittMinutesOfDay(new Date("2026-11-04T05:00:00Z"))).toBe(0);
  });
});

describe("date helpers", () => {
  it("validates ISO dates strictly", () => {
    expect(isISODate("2026-11-03")).toBe(true);
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("2026-11-3")).toBe(false);
    expect(isISODate("2026-11-03'; drop")).toBe(false);
  });

  it("adds days across month and DST boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-11-03", -1)).toBe("2026-11-02");
  });

  it("labels days relative to today", () => {
    expect(dayLabel("2026-11-03", "2026-11-03")).toBe("Today");
    expect(dayLabel("2026-11-04", "2026-11-03")).toBe("Tomorrow");
    expect(dayLabel("2026-11-05", "2026-11-03")).toBe("Thu, Nov 5");
  });
});

describe("time formatting", () => {
  it("parses and validates HH:MM", () => {
    expect(isHHMM("09:05")).toBe(true);
    expect(isHHMM("24:00")).toBe(false);
    expect(isHHMM("9:05")).toBe(false);
    expect(parseHHMM("19:45")).toBe(1185);
    expect(toHHMM(1185)).toBe("19:45");
  });

  it("formats clock times", () => {
    expect(formatClock(0)).toBe("12 AM");
    expect(formatClock(9 * 60 + 15)).toBe("9:15 AM");
    expect(formatClock(12 * 60)).toBe("12 PM");
    expect(formatClock(1379)).toBe("10:59 PM");
    expect(formatClock(1440)).toBe("midnight");
  });

  it("formats durations", () => {
    expect(formatDuration(15)).toBe("15 min");
    expect(formatDuration(60)).toBe("1 hr");
    expect(formatDuration(135)).toBe("2 hr 15 min");
  });
});
