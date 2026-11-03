import { describe, expect, it } from "vitest";
import { freeIntervals, roomStatusAt, type ScheduleBlock } from "@/lib/roomState";

const ev = (startMin: number, endMin: number, title = "CS 0401"): ScheduleBlock => ({ startMin, endMin, kind: "EVENT", title });
const closed = (startMin: number, endMin: number): ScheduleBlock => ({ startMin, endMin, kind: "CLOSED", title: null });
const h = (hours: number, mins = 0) => hours * 60 + mins;

// A typical room: closed 6-7am and after 11pm, two classes.
const day = [closed(h(6), h(7)), ev(h(9), h(10, 15), "HIST 1083"), ev(h(11), h(12, 15), "STAT 1000"), closed(h(23), h(24))];

describe("freeIntervals", () => {
  it("treats everything before 6 AM as closed", () => {
    expect(freeIntervals([])).toEqual([[h(6), h(24)]]);
  });

  it("returns the gaps between blocks", () => {
    expect(freeIntervals(day)).toEqual([
      [h(7), h(9)],
      [h(10, 15), h(11)],
      [h(12, 15), h(23)],
    ]);
  });

  it("merges overlapping and back-to-back blocks", () => {
    expect(freeIntervals([ev(h(9), h(10)), ev(h(9, 30), h(11)), ev(h(11), h(12))])).toEqual([
      [h(6), h(9)],
      [h(12), h(24)],
    ]);
  });
});

describe("roomStatusAt", () => {
  it("is free until the next class, naming it", () => {
    expect(roomStatusAt(day, h(8))).toEqual({
      status: "free",
      until: h(9),
      freeMin: 60,
      endsBecause: "event",
      nextTitle: "HIST 1083",
    });
  });

  it("is free until closing when nothing else is scheduled", () => {
    const s = roomStatusAt(day, h(13));
    expect(s).toMatchObject({ status: "free", until: h(23), endsBecause: "closing", nextTitle: null });
  });

  it("reports when a busy room frees up, skipping back-to-back classes", () => {
    const blocks = [ev(h(9), h(10)), ev(h(10), h(11), "MATH 0220")];
    expect(roomStatusAt(blocks, h(9, 30))).toEqual({ status: "busy", title: "CS 0401", freeAt: h(11) });
  });

  it("treats a class's end minute as free (half-open intervals)", () => {
    expect(roomStatusAt(day, h(10, 15)).status).toBe("free");
    expect(roomStatusAt(day, h(10, 14)).status).toBe("busy");
  });

  it("is closed before opening and after closing", () => {
    expect(roomStatusAt(day, h(6, 30))).toEqual({ status: "closed", freeAt: h(7) });
    expect(roomStatusAt(day, h(3))).toEqual({ status: "closed", freeAt: h(7) });
    expect(roomStatusAt(day, h(23, 30))).toEqual({ status: "closed", freeAt: null });
  });

  it("says busy (not closed) when an event overlaps closed hours", () => {
    expect(roomStatusAt([closed(h(22), h(24)), ev(h(21), h(23))], h(22, 30))).toMatchObject({ status: "busy" });
  });

  it("is free until midnight when the room never closes", () => {
    expect(roomStatusAt([], h(20))).toMatchObject({ status: "free", until: h(24), freeMin: 240, endsBecause: "closing" });
  });

  it("handles a room booked all day", () => {
    expect(roomStatusAt([ev(h(6), h(24))], h(12))).toEqual({ status: "busy", title: "CS 0401", freeAt: null });
  });
});
