import { describe, expect, it } from "vitest";
import { studyEventIcs } from "@/lib/ics";

describe("studyEventIcs", () => {
  const ics = studyEventIcs({
    roomId: "654",
    title: "Irish Nationality Room",
    location: "Cathedral of Learning 127, Pittsburgh",
    date: "2026-11-03",
    startMin: 15 * 60 + 30,
    endMin: 20 * 60 + 30,
    url: "https://25live.collegenet.com/pro/pitt#!/home/location/654/details",
    now: new Date("2026-11-03T20:00:00.000Z"),
  });

  it("writes a local-time event with CRLF line endings", () => {
    expect(ics).toContain("DTSTART;TZID=America/New_York:20261103T153000\r\n");
    expect(ics).toContain("DTEND;TZID=America/New_York:20261103T203000\r\n");
    expect(ics).toContain("DTSTAMP:20261103T200000Z\r\n");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0")).toBe(true);
  });

  it("escapes text fields and says it isn't a reservation", () => {
    expect(ics).toContain("LOCATION:Cathedral of Learning 127\\, Pittsburgh");
    expect(ics).toContain("SUMMARY:Study · Irish Nationality Room");
    expect(ics).toMatch(/This is not a reservation\; confirm/);
  });

  it("ends a stretch that runs to midnight at 11:59 PM the same day", () => {
    const late = studyEventIcs({ roomId: "1", title: "X", location: "Y", date: "2026-11-03", startMin: 1320, endMin: 1440, url: "u" });
    expect(late).toContain("DTEND;TZID=America/New_York:20261103T235900");
  });
});
