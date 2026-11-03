import { MIN_USEFUL_FREE_MIN, evaluateRooms, type FinderBuilding, type FinderRoom, type FinderState } from "./finder";
import { roomStatusAt } from "./roomState";

export type DashboardStats = {
  open: number;
  openHourAgo: number;
  longFree: number;
  longestUntil: number | null;
  soon: number;
  soonNext: number | null;
  inClass: number;
  total: number;
  savedOpen: number;
  savedTotal: number;
};

const SOON_MIN = 30;
const LONG_MIN = 120;

// The numbers on the stat cards, all under the current filters.
export function dashboardStats<R extends FinderRoom>(opts: {
  rooms: R[];
  buildings: FinderBuilding[];
  atMin: number;
  state: FinderState;
  favorites: Set<string>;
}): DashboardStats {
  const base = { ...opts, userLoc: null };
  const now = evaluateRooms(base);
  const before = evaluateRooms({ ...base, atMin: Math.max(0, opts.atMin - 60) });
  const all = [...now.available, ...now.unavailable];

  let longFree = 0;
  let longestUntil: number | null = null;
  for (const r of now.available) {
    if (r.status.status !== "free") continue;
    if (r.status.freeMin >= LONG_MIN) longFree++;
    longestUntil = Math.max(longestUntil ?? 0, r.status.until);
  }

  // A room "opens soon" only if it will then stay free long enough to count as open,
  // not just for the passing period before its next class.
  const threshold = Math.max(opts.state.minFree, MIN_USEFUL_FREE_MIN);
  let soon = 0;
  let soonNext: number | null = null;
  let inClass = 0;
  for (const r of now.unavailable) {
    if (r.status.status === "busy") inClass++;
    const freeAt = r.status.status === "free" ? null : r.status.freeAt;
    if (freeAt === null || freeAt <= opts.atMin || freeAt > opts.atMin + SOON_MIN) continue;
    const then = roomStatusAt(r.room.blocks, freeAt);
    if (then.status === "free" && then.freeMin >= threshold) {
      soon++;
      soonNext = Math.min(soonNext ?? Infinity, freeAt);
    }
  }

  const saved = all.filter((r) => opts.favorites.has(r.room.id));
  return {
    open: now.available.length,
    openHourAgo: before.available.length,
    longFree,
    longestUntil,
    soon,
    soonNext,
    inClass,
    total: all.length,
    savedOpen: saved.filter((r) => now.available.includes(r)).length,
    savedTotal: saved.length,
  };
}

// The stretch of the day when the most rooms have classes, e.g. [600, 780] for
// 10 AM–1 PM: every half hour within 90% of the peak, around the peak itself.
export function busiestWindow(rooms: { blocks: { startMin: number; endMin: number; kind: string }[] }[]): [number, number] | null {
  const slots: number[] = [];
  for (let t = 7 * 60; t < 22 * 60; t += 30) {
    let n = 0;
    for (const r of rooms) {
      if (r.blocks.some((b) => b.kind === "EVENT" && b.startMin < t + 30 && b.endMin > t)) n++;
    }
    slots.push(n);
  }
  const peak = Math.max(0, ...slots);
  if (peak === 0) return null;
  const i = slots.indexOf(peak);
  let start = i;
  let end = i;
  while (start > 0 && slots[start - 1] >= peak * 0.9) start--;
  while (end < slots.length - 1 && slots[end + 1] >= peak * 0.9) end++;
  return [7 * 60 + start * 30, 7 * 60 + (end + 1) * 30];
}

// How many rooms matching the filters are open at each step of the day, for the
// time scrubber's chart.
export function openTimeline<R extends FinderRoom>(opts: {
  rooms: R[];
  buildings: FinderBuilding[];
  state: FinderState;
  favorites: Set<string>;
  from?: number;
  to?: number;
  step?: number;
}): { min: number; open: number }[] {
  const { from = 6 * 60, to = 24 * 60, step = 15 } = opts;
  const out: { min: number; open: number }[] = [];
  for (let t = from; t < to; t += step) {
    out.push({ min: t, open: evaluateRooms({ ...opts, atMin: t, userLoc: null }).available.length });
  }
  return out;
}
