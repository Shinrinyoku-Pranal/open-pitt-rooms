"use client";

import { MIN_USEFUL_FREE_MIN } from "@/lib/finder";
import { freeIntervals } from "@/lib/roomState";
import { dayLabel, formatClock, formatDuration } from "@/lib/time";
import { useRoomWeek } from "./hooks";

const START = 6 * 60;
const END = 24 * 60;

function pct(min: number) {
  return `${((Math.min(Math.max(min, START), END) - START) / (END - START)) * 100}%`;
}

// The room's next seven days: a bar per day and its longest usable free stretch.
// Picking a day jumps the whole app to the start of that stretch.
export default function RoomWeek({
  roomId,
  today,
  activeDay,
  nowMin,
  onJump,
}: {
  roomId: string;
  today: string;
  activeDay: string;
  nowMin: number;
  onJump: (date: string, min: number) => void;
}) {
  const { week, failed } = useRoomWeek(roomId);

  if (failed) return <p className="text-[12.5px] text-muted">Couldn&apos;t load this room&apos;s week.</p>;
  if (!week) {
    return (
      <div className="grid gap-2" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-7 animate-pulse rounded-md bg-surface" />
        ))}
      </div>
    );
  }

  return (
    <ul className="grid gap-1">
      {week.days.map(({ date, loaded, blocks }) => {
        const from = date === today ? nowMin : 0;
        const free = freeIntervals(blocks)
          .map(([s, e]) => [Math.max(s, from), e] as const)
          .filter(([s, e]) => e - s >= MIN_USEFUL_FREE_MIN);
        const best = free.reduce<readonly [number, number] | null>((a, b) => (!a || b[1] - b[0] > a[1] - a[0] ? b : a), null);
        const busy = blocks.filter((b) => b.kind === "EVENT");
        const active = date === activeDay;
        return (
          <li key={date}>
            <button
              type="button"
              disabled={!best}
              onClick={() => best && onJump(date, best[0])}
              className={`grid w-full grid-cols-[4.75rem_1fr] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-1.5 text-left transition-colors enabled:hover:bg-surface ${
                active ? "bg-surface" : ""
              }`}
            >
              <span className={`text-[12.5px] font-medium ${active ? "text-fg" : "text-muted"}`}>{dayLabel(date, today)}</span>
              <span className="relative h-2 overflow-hidden rounded-full bg-closed-soft" aria-hidden="true">
                {loaded &&
                  freeIntervals(blocks).map(([s, e]) => (
                    <span key={s} className="absolute inset-y-0 bg-free/70" style={{ left: pct(s), width: `calc(${pct(e)} - ${pct(s)})` }} />
                  ))}
                {busy.map((b, i) => (
                  <span
                    // Cross-listed courses share a time slot, so the index keeps keys unique.
                    key={`${b.startMin}-${b.endMin}-${i}`}
                    className="absolute inset-y-0 bg-busy/75"
                    style={{ left: pct(b.startMin), width: `calc(${pct(b.endMin)} - ${pct(b.startMin)})` }}
                  />
                ))}
              </span>
              <span className="col-start-2 truncate font-mono text-[11.5px] text-faint">
                {!loaded
                  ? "Schedule not loaded yet"
                  : best
                    ? `Free ${formatClock(best[0])}–${formatClock(best[1])} · ${formatDuration(best[1] - best[0])}`
                    : "No long free stretch"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
