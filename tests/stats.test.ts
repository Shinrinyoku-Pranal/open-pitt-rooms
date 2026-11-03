import { describe, expect, it } from "vitest";
import { busiestWindow, dashboardStats, openTimeline } from "@/lib/stats";
import { DEFAULT_STATE } from "@/lib/finder";

describe("dashboard stats", () => {
  const ev = (s: number, e: number) => ({ startMin: s, endMin: e, kind: "EVENT" as const, title: "X" });
  const room = (id: string, blocks: ReturnType<typeof ev>[]) => ({
    id,
    displayName: id,
    roomNumber: id,
    code: id,
    capacity: 20,
    features: [],
    buildingId: "CL",
    blocks,
  });
  const rooms = [
    room("a", []), // free all day
    room("b", [ev(500, 560)]), // in class at 9:00, free at 9:20
    room("c", [ev(480, 600)]), // in class until 10:00
    room("d", [ev(600, 700)]), // free until 10:00 at 9:00
    room("e", [ev(500, 560), ev(570, 650)]), // frees at 9:20 but only for the 10-minute break
  ];
  const buildings = [{ id: "CL", name: "Cathedral of Learning", shortName: "Cathedral", lat: 0, lng: 0 }];

  it("counts open, long, soon, in class and saved rooms", () => {
    const s = dashboardStats({ rooms, buildings, atMin: 540, state: DEFAULT_STATE, favorites: new Set(["a", "c"]) });
    expect(s).toMatchObject({ open: 2, longFree: 1, soon: 1, soonNext: 560, inClass: 3, total: 5, savedOpen: 1, savedTotal: 2 });
    expect(s.openHourAgo).toBe(4); // at 8:00 only c was busy
  });

  it("finds the busiest stretch of the day", () => {
    expect(busiestWindow(rooms)).toEqual([480, 570]); // b and c overlap 8:00–9:30
    expect(busiestWindow([room("x", [])])).toBeNull();
  });
});

describe("openTimeline", () => {
  const ev = (s: number, e: number) => ({ startMin: s, endMin: e, kind: "EVENT" as const, title: "X" });
  const room = (id: string, blocks: ReturnType<typeof ev>[]) => ({
    id,
    displayName: id,
    roomNumber: id,
    code: id,
    capacity: 20,
    features: [],
    buildingId: "CL",
    blocks,
  });
  const buildings = [{ id: "CL", name: "Cathedral of Learning", shortName: "Cathedral", lat: 0, lng: 0 }];

  it("counts open rooms at each step under the filters", () => {
    const rooms = [room("a", [ev(540, 600)]), room("b", [])];
    const line = openTimeline({ rooms, buildings, state: DEFAULT_STATE, favorites: new Set(), from: 480, to: 660, step: 60 });
    expect(line).toEqual([
      { min: 480, open: 2 },
      { min: 540, open: 1 },
      { min: 600, open: 2 },
    ]);
  });
});
