import { FEATURES, type FeatureSlug, type RoomKindName } from "./rooms";
import { roomStatusAt, type RoomStatus, type ScheduleBlock } from "./roomState";
import { distanceMeters, type LatLng } from "./geo";
import { isHHMM, isISODate } from "./time";

export type SortMode = "longest" | "nearest" | "building";
export type RoomType = "all" | "classroom" | "nationality" | "departmental";

export const ROOM_TYPES: Record<RoomType, string> = {
  all: "All rooms",
  classroom: "Classrooms",
  nationality: "Nationality Rooms",
  departmental: "Departmental",
};

const KIND_FOR_TYPE: Record<Exclude<RoomType, "all">, RoomKindName> = {
  classroom: "REGISTRAR",
  nationality: "NATIONALITY",
  departmental: "DEPARTMENTAL",
};

export type FinderState = {
  date: string | null; // null = today
  time: string | null; // "HH:MM", null = now
  buildings: string[];
  minCap: number;
  features: FeatureSlug[];
  minFree: number; // minutes the room must stay free; 0 = any
  type: RoomType;
  sort: SortMode;
  q: string;
  favoritesOnly: boolean;
  room: string | null; // selected room
};

export const DEFAULT_STATE: FinderState = {
  date: null,
  time: null,
  buildings: [],
  minCap: 0,
  features: [],
  minFree: 0,
  type: "all",
  sort: "longest",
  q: "",
  favoritesOnly: false,
  room: null,
};

// Presets shown in the filter panel; typed queries ("90 minutes", "group of 6") can
// ask for any value up to the maximums.
export const MIN_FREE_OPTIONS = [0, 30, 60, 120, 180] as const;
export const MAX_MIN_FREE = 12 * 60;
// A gap shorter than this isn't a usable study slot, so it never counts as "open" even
// with no minimum selected. Pitt's passing periods are 10 minutes (MWF) and 15 minutes
// (TuTh), so the bar sits just above the longer one.
export const MIN_USEFUL_FREE_MIN = 20;
export const MIN_CAP_OPTIONS = [0, 10, 25, 50, 100] as const;
export const MAX_MIN_CAP = 500;

const SORTS: SortMode[] = ["longest", "nearest", "building"];

function intParam(v: string | null, max: number): number {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= max ? n : 0;
}

export function parseFinderState(params: URLSearchParams, buildingIds: Set<string>): FinderState {
  const date = params.get("date");
  const time = params.get("t");
  const sort = params.get("sort") as SortMode | null;
  const type = params.get("type") as RoomType | null;
  return {
    date: date && isISODate(date) ? date : null,
    time: time && isHHMM(time) ? time : null,
    buildings: (params.get("b") ?? "").split(",").filter((b) => buildingIds.has(b)),
    minCap: intParam(params.get("cap"), MAX_MIN_CAP),
    features: (params.get("f") ?? "").split(",").filter((f): f is FeatureSlug => f in FEATURES),
    minFree: intParam(params.get("free"), MAX_MIN_FREE),
    type: type && type in ROOM_TYPES ? type : "all",
    sort: sort && SORTS.includes(sort) ? sort : "longest",
    q: (params.get("q") ?? "").slice(0, 60),
    favoritesOnly: params.get("fav") === "1",
    room: params.get("room"),
  };
}

export function serializeFinderState(s: FinderState): string {
  const p = new URLSearchParams();
  if (s.date) p.set("date", s.date);
  if (s.time) p.set("t", s.time);
  if (s.buildings.length) p.set("b", s.buildings.join(","));
  if (s.minCap) p.set("cap", String(s.minCap));
  if (s.features.length) p.set("f", s.features.join(","));
  if (s.minFree) p.set("free", String(s.minFree));
  if (s.type !== "all") p.set("type", s.type);
  if (s.sort !== "longest") p.set("sort", s.sort);
  if (s.q) p.set("q", s.q);
  if (s.favoritesOnly) p.set("fav", "1");
  if (s.room) p.set("room", s.room);
  return p.toString();
}

export function activeFilterCount(s: FinderState): number {
  return (
    (s.buildings.length ? 1 : 0) +
    (s.minCap ? 1 : 0) +
    s.features.length +
    (s.minFree ? 1 : 0) +
    (s.type !== "all" ? 1 : 0) +
    (s.favoritesOnly ? 1 : 0)
  );
}

export type FinderRoom = {
  id: string;
  displayName: string;
  roomNumber: string;
  code: string;
  capacity: number | null;
  kind?: RoomKindName;
  features: FeatureSlug[];
  buildingId: string;
  blocks: ScheduleBlock[];
};

export type FinderBuilding = { id: string; name: string; shortName: string; lat: number; lng: number };

export type EvaluatedRoom<R extends FinderRoom> = {
  room: R;
  building: FinderBuilding;
  status: RoomStatus;
  distanceM: number | null;
};

function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function evaluateRooms<R extends FinderRoom>(opts: {
  rooms: R[];
  buildings: FinderBuilding[];
  atMin: number;
  state: FinderState;
  userLoc: LatLng | null;
  favorites: Set<string>;
}): { available: EvaluatedRoom<R>[]; unavailable: EvaluatedRoom<R>[] } {
  const { rooms, atMin, state, userLoc, favorites } = opts;
  const byId = new Map(opts.buildings.map((b) => [b.id, b]));
  const q = state.q.trim().toLowerCase();

  const matches: EvaluatedRoom<R>[] = [];
  for (const room of rooms) {
    const building = byId.get(room.buildingId);
    if (!building) continue;
    if (state.buildings.length && !state.buildings.includes(room.buildingId)) continue;
    if (state.minCap && (room.capacity ?? 0) < state.minCap) continue;
    if (state.features.some((f) => !room.features.includes(f))) continue;
    if (state.type !== "all" && room.kind !== KIND_FOR_TYPE[state.type]) continue;
    if (state.favoritesOnly && !favorites.has(room.id)) continue;
    if (q) {
      const haystack = `${room.displayName} ${room.code} ${room.roomNumber} ${building.name} ${building.shortName}`.toLowerCase();
      if (!q.split(/\s+/).every((term) => haystack.includes(term))) continue;
    }
    matches.push({
      room,
      building,
      status: roomStatusAt(room.blocks, atMin),
      distanceM: userLoc ? distanceMeters(userLoc, building) : null,
    });
  }

  const threshold = Math.max(state.minFree, MIN_USEFUL_FREE_MIN);
  const available: EvaluatedRoom<R>[] = [];
  const unavailable: EvaluatedRoom<R>[] = [];
  for (const m of matches) {
    (m.status.status === "free" && m.status.freeMin >= threshold ? available : unavailable).push(m);
  }

  const byName = (a: EvaluatedRoom<R>, b: EvaluatedRoom<R>) =>
    naturalCompare(a.building.shortName, b.building.shortName) || naturalCompare(a.room.roomNumber, b.room.roomNumber);
  const freeMin = (m: EvaluatedRoom<R>) => (m.status.status === "free" ? m.status.freeMin : 0);

  available.sort((a, b) => {
    if (state.sort === "nearest" && a.distanceM !== null && b.distanceM !== null) {
      return a.distanceM - b.distanceM || freeMin(b) - freeMin(a);
    }
    if (state.sort === "building") return byName(a, b);
    return freeMin(b) - freeMin(a) || byName(a, b);
  });

  const freeAt = (m: EvaluatedRoom<R>) => (m.status.status !== "free" ? (m.status.freeAt ?? Infinity) : m.status.until);
  unavailable.sort((a, b) => freeAt(a) - freeAt(b) || byName(a, b));

  return { available, unavailable };
}
