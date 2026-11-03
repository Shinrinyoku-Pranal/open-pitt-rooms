import { describe, expect, it } from "vitest";
import {
  DEFAULT_STATE,
  evaluateRooms,
  parseFinderState,
  serializeFinderState,
  type FinderBuilding,
  type FinderRoom,
  type FinderState,
} from "@/lib/finder";

const buildings: FinderBuilding[] = [
  { id: "CL", name: "Cathedral of Learning", shortName: "Cathedral", lat: 40.4443, lng: -79.9532 },
  { id: "BENDM", name: "Benedum Hall", shortName: "Benedum", lat: 40.4438, lng: -79.9586 },
];

const room = (id: string, buildingId: string, roomNumber: string, blocks: FinderRoom["blocks"], extra: Partial<FinderRoom> = {}): FinderRoom => ({
  id,
  displayName: `${buildingId} ${roomNumber}`,
  roomNumber,
  code: `${buildingId}${roomNumber}`,
  capacity: 30,
  features: [],
  buildingId,
  blocks,
  ...extra,
});
const ev = (s: number, e: number) => ({ startMin: s, endMin: e, kind: "EVENT" as const, title: "X" });

const rooms = [
  room("1", "CL", "101", [ev(600, 660)]), // free until 10:00 at 9:00 -> 60 min
  room("2", "CL", "202", [ev(900, 960)], { features: ["whiteboard"], capacity: 80, kind: "NATIONALITY" }), // free 6 hrs
  room("3", "BENDM", "9", [ev(540, 600)]), // busy at 9:00
  room("4", "BENDM", "10", [ev(550, 600)]), // free only 10 min at 9:00
  room("5", "BENDM", "11", [ev(555, 600)]), // free only 15 min at 9:00 (a TuTh passing period)
];

const at9 = (state: Partial<FinderState> = {}, favorites = new Set<string>()) =>
  evaluateRooms({ rooms, buildings, atMin: 540, state: { ...DEFAULT_STATE, ...state }, userLoc: null, favorites });

describe("evaluateRooms", () => {
  it("sorts by longest free by default and hides short gaps", () => {
    const { available, unavailable } = at9();
    expect(available.map((r) => r.room.id)).toEqual(["2", "1"]);
    expect(unavailable.map((r) => r.room.id).sort()).toEqual(["3", "4", "5"]);
  });

  it("applies the minimum free time", () => {
    expect(at9({ minFree: 120 }).available.map((r) => r.room.id)).toEqual(["2"]);
  });

  it("filters by building, features, capacity, and favorites", () => {
    expect(at9({ buildings: ["BENDM"] }).available).toEqual([]);
    expect(at9({ features: ["whiteboard"] }).available.map((r) => r.room.id)).toEqual(["2"]);
    expect(at9({ minCap: 50 }).available.map((r) => r.room.id)).toEqual(["2"]);
    expect(at9({ favoritesOnly: true }, new Set(["1"])).available.map((r) => r.room.id)).toEqual(["1"]);
  });

  it("filters by room type and accepts any minimum from a typed query", () => {
    expect(at9({ type: "nationality" }).available.map((r) => r.room.id)).toEqual(["2"]);
    expect(at9({ type: "departmental" }).available).toEqual([]);
    expect(at9({ minFree: 90 }).available.map((r) => r.room.id)).toEqual(["2"]);
    expect(at9({ minCap: 31 }).available.map((r) => r.room.id)).toEqual(["2"]);
  });

  it("searches across room and building names", () => {
    expect(at9({ q: "cathedral 202" }).available.map((r) => r.room.id)).toEqual(["2"]);
    expect(at9({ q: "benedum" }).available).toEqual([]);
  });

  it("sorts by distance when location is known", () => {
    const { available } = evaluateRooms({
      rooms,
      buildings,
      atMin: 480,
      state: { ...DEFAULT_STATE, sort: "nearest" },
      userLoc: { lat: 40.4438, lng: -79.9586 }, // at Benedum
      favorites: new Set(),
    });
    expect(available[0].building.id).toBe("BENDM");
    expect(available[0].distanceM).toBeLessThan(5);
  });
});

describe("URL state", () => {
  const ids = new Set(["CL", "BENDM"]);

  it("round-trips", () => {
    const state: FinderState = {
      ...DEFAULT_STATE,
      date: "2026-11-04",
      time: "19:00",
      buildings: ["CL"],
      features: ["whiteboard", "tables"],
      minFree: 60,
      minCap: 25,
      sort: "nearest",
      q: "nationality",
      favoritesOnly: true,
      type: "nationality",
      room: "654",
    };
    expect(parseFinderState(new URLSearchParams(serializeFinderState(state)), ids)).toEqual(state);
  });

  it("keeps the default state out of the URL", () => {
    expect(serializeFinderState(DEFAULT_STATE)).toBe("");
  });

  it("ignores junk values", () => {
    const parsed = parseFinderState(
      new URLSearchParams("date=nope&t=25:00&b=CL,EVIL&f=whiteboard,<script>&free=7.5&cap=-1&sort=random&type=evil"),
      ids,
    );
    expect(parsed).toEqual({ ...DEFAULT_STATE, buildings: ["CL"], features: ["whiteboard"] });
  });
});
