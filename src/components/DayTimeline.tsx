import { DAY_END, UNKNOWN_BEFORE_MIN, freeIntervals, type ScheduleBlock } from "@/lib/roomState";
import { formatClock } from "@/lib/time";

const START = UNKNOWN_BEFORE_MIN;
const SPAN = DAY_END - START;
const TICKS = [6, 9, 12, 15, 18, 21, 24].map((h) => h * 60);

function pct(min: number) {
  return `${(Math.min(Math.max(min - START, 0), SPAN) / SPAN) * 100}%`;
}

function tick(min: number) {
  return min >= DAY_END ? "12a" : formatClock(min).replace(":00", "").replace(" AM", "a").replace(" PM", "p");
}

export default function DayTimeline({ blocks, atMin }: { blocks: ScheduleBlock[]; atMin: number }) {
  const free = freeIntervals(blocks).filter(([, e]) => e > START);
  const events = blocks.filter((b) => b.kind === "EVENT");
  const showMarker = atMin >= START && atMin <= DAY_END;
  const rows = [
    ...free.map(([s, e]) => ({ s: Math.max(s, START), e, open: true, label: "Open" })),
    ...events.map((b) => ({ s: b.startMin, e: b.endMin, open: false, label: b.title ?? "Reserved" })),
  ].sort((a, b) => a.s - b.s || a.e - b.e);

  return (
    <div>
      <div className="relative h-2.5 rounded-full bg-closed-soft" role="img" aria-label="Room schedule for the day">
        {free.map(([s, e]) => (
          <div
            key={`f${s}`}
            className="absolute inset-y-0 rounded-full bg-free/70"
            style={{ left: pct(s), width: `calc(${pct(e)} - ${pct(s)})` }}
          />
        ))}
        {events.map((b, i) => (
          <div
            key={`e${b.startMin}-${b.endMin}-${i}`}
            className="absolute inset-y-0 rounded-full bg-busy/80"
            style={{ left: pct(b.startMin), width: `calc(${pct(b.endMin)} - ${pct(b.startMin)})` }}
            title={`${b.title ?? "Reserved"} · ${formatClock(b.startMin)}–${formatClock(b.endMin)}`}
          />
        ))}
        {showMarker && (
          <div
            className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-fg shadow-[0_0_0_2px_var(--panel)]"
            style={{ left: pct(atMin) }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="relative mt-1.5 h-3 text-[10px] tabular-nums text-faint" aria-hidden="true">
        {TICKS.map((t, i) => (
          <span
            key={t}
            className={`absolute ${i === 0 ? "" : i === TICKS.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
            style={{ left: pct(t) }}
          >
            {tick(t)}
          </span>
        ))}
      </div>
      <ul className="mt-3 grid gap-1.5 text-[13px]">
        {rows.map((row, i) => (
          <li key={`${row.s}-${row.e}-${i}`} className="flex items-center gap-2.5">
            <span className={`size-1.5 shrink-0 rounded-full ${row.open ? "bg-free" : "bg-busy"}`} aria-hidden="true" />
            <span className="w-[8.5rem] shrink-0 tabular-nums text-muted">
              {formatClock(row.s)} – {formatClock(row.e)}
            </span>
            <span className={`truncate ${row.open ? "text-free" : "text-fg"}`}>{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
