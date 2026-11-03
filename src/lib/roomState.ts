// Pure availability logic, shared by the API and the browser.
// Intervals are half-open [start, end) in minutes since Pitt-local midnight.

export const DAY_END = 1440;
// 25Live's grid starts at 6 AM, so anything earlier is unknown; treat it as closed.
export const UNKNOWN_BEFORE_MIN = 6 * 60;

export type ScheduleBlock = {
  startMin: number;
  endMin: number;
  kind: "EVENT" | "CLOSED";
  title: string | null;
};

export type RoomStatus =
  | {
      status: "free";
      until: number; // minute the free stretch ends (DAY_END = midnight)
      freeMin: number;
      endsBecause: "event" | "closing";
      nextTitle: string | null;
    }
  | { status: "busy"; title: string | null; freeAt: number | null }
  | { status: "closed"; freeAt: number | null };

function withImplicitClosed(blocks: ScheduleBlock[]): ScheduleBlock[] {
  const earlyMorning: ScheduleBlock = { startMin: 0, endMin: UNKNOWN_BEFORE_MIN, kind: "CLOSED", title: null };
  return [earlyMorning, ...blocks].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
}

// The complement of all blocks within the day.
export function freeIntervals(blocks: ScheduleBlock[]): [number, number][] {
  const out: [number, number][] = [];
  let cursor = 0;
  for (const b of withImplicitClosed(blocks)) {
    if (b.startMin > cursor) out.push([cursor, Math.min(b.startMin, DAY_END)]);
    cursor = Math.max(cursor, b.endMin);
    if (cursor >= DAY_END) break;
  }
  if (cursor < DAY_END) out.push([cursor, DAY_END]);
  return out;
}

export function roomStatusAt(blocks: ScheduleBlock[], atMin: number): RoomStatus {
  const free = freeIntervals(blocks);
  const current = free.find(([s, e]) => s <= atMin && atMin < e);

  if (current) {
    const [, end] = current;
    const next = blocks
      .filter((b) => b.startMin === end)
      .sort((a, b) => (a.kind === "EVENT" ? -1 : 1) - (b.kind === "EVENT" ? -1 : 1))[0];
    return {
      status: "free",
      until: end,
      freeMin: end - atMin,
      endsBecause: end >= DAY_END || !next || next.kind === "CLOSED" ? "closing" : "event",
      nextTitle: next?.kind === "EVENT" ? next.title : null,
    };
  }

  const nextFree = free.find(([s]) => s > atMin);
  const freeAt = nextFree ? nextFree[0] : null;
  const event = blocks.find((b) => b.kind === "EVENT" && b.startMin <= atMin && atMin < b.endMin);
  if (event) return { status: "busy", title: event.title, freeAt };
  return { status: "closed", freeAt };
}
