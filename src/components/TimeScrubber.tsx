"use client";

import { useRef } from "react";
import { dayLabel, formatClock } from "@/lib/time";

const FROM = 6 * 60;
const TO = 24 * 60;
const STEP = 15;
const TICKS = [6, 9, 12, 15, 18, 21].map((h) => h * 60);

function tickLabel(min: number) {
  return formatClock(min).replace(":00", "").replace(" AM", "a").replace(" PM", "p");
}

// The day at a glance: bars show how many matching rooms are open at each quarter
// hour. Dragging along it (or using the arrow keys) picks the time.
export default function TimeScrubber({
  dates,
  today,
  day,
  onDay,
  series,
  atMin,
  nowMin,
  isLive,
  onTime,
  onNow,
  busiest,
  openNow,
}: {
  dates: string[];
  today: string;
  day: string;
  onDay: (d: string) => void;
  series: { min: number; open: number }[];
  atMin: number;
  nowMin: number | null;
  isLive: boolean;
  onTime: (min: number) => void;
  onNow: () => void;
  busiest: [number, number] | null;
  // Rooms open at exactly the chosen time (the bars are quarter-hour samples).
  openNow: number;
}) {
  const track = useRef<HTMLDivElement>(null);
  const max = Math.max(1, ...series.map((s) => s.open));
  const pos = (min: number) => `${((Math.min(Math.max(min, FROM), TO) - FROM) / (TO - FROM)) * 100}%`;
  const current = series.find((s) => atMin >= s.min && atMin < s.min + STEP);

  const pick = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r) return;
    const ratio = Math.min(Math.max((clientX - r.left) / r.width, 0), 0.9999);
    onTime(FROM + Math.floor((ratio * (TO - FROM)) / STEP) * STEP);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <div className="no-scrollbar -ml-1 flex min-w-0 flex-1 gap-1 overflow-x-auto pl-1">
          {dates.map((d) => {
            const on = d === day;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => onDay(d)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
                  on ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface hover:text-fg"
                }`}
              >
                {dayLabel(d, today)}
              </button>
            );
          })}
        </div>
        {busiest && (
          <span className="hidden shrink-0 text-[12px] text-faint xl:inline">
            Busiest {formatClock(busiest[0])}–{formatClock(busiest[1])}
          </span>
        )}
        <button
          type="button"
          onClick={onNow}
          aria-pressed={isLive}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-medium ${
            isLive ? "border-free/40 text-free" : "border-line-strong text-muted hover:text-fg"
          }`}
        >
          <span className={`size-1.5 rounded-full ${isLive ? "animate-pulse bg-free" : "bg-faint"}`} />
          Now
        </button>
      </div>

      <div className="relative pt-6">
        {/* Playhead label */}
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-accent px-1.5 py-0.5 font-mono text-[11px] font-semibold text-accent-fg"
          style={{ left: `clamp(48px, ${pos(atMin)}, calc(100% - 48px))` }}
        >
          {formatClock(atMin)} · {openNow} open
        </div>

        <div
          ref={track}
          role="slider"
          tabIndex={0}
          aria-label="Time of day"
          aria-valuemin={FROM}
          aria-valuemax={TO - STEP}
          aria-valuenow={atMin}
          aria-valuetext={`${formatClock(atMin)}, ${openNow} rooms open`}
          className="relative flex h-12 cursor-ew-resize touch-none items-end gap-px rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pick(e.clientX);
          }}
          onPointerMove={(e) => e.buttons & 1 && pick(e.clientX)}
          onKeyDown={(e) => {
            const delta = { ArrowLeft: -STEP, ArrowRight: STEP, ArrowDown: -60, ArrowUp: 60 }[e.key];
            if (delta) {
              e.preventDefault();
              onTime(Math.min(Math.max(atMin - (atMin % STEP) + delta, FROM), TO - STEP));
            } else if (e.key === "Home" || e.key === "End") {
              e.preventDefault();
              onTime(e.key === "Home" ? FROM : TO - STEP);
            }
          }}
        >
          {series.map((s) => {
            const past = nowMin !== null && s.min + STEP <= nowMin;
            const active = s === current;
            return (
              <span
                key={s.min}
                className={`min-w-0 flex-1 rounded-t-[2px] transition-[height,background-color] duration-300 ${
                  active ? "bg-fg" : past ? "bg-fg/15" : "bg-free/70"
                }`}
                style={{ height: `${Math.max(6, (s.open / max) * 100)}%` }}
              />
            );
          })}
          {nowMin !== null && !isLive && nowMin >= FROM && (
            <span
              className="pointer-events-none absolute -inset-y-1 w-px border-l border-dashed border-fg/50"
              style={{ left: pos(nowMin) }}
              aria-hidden="true"
            />
          )}
          <span
            className="pointer-events-none absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-fg shadow-[0_0_10px_var(--fg)]"
            style={{ left: pos(atMin + STEP / 2) }}
            aria-hidden="true"
          />
        </div>

        <div className="relative mt-1.5 h-3 font-mono text-[10px] text-faint" aria-hidden="true">
          {TICKS.map((t) => (
            <span key={t} className="absolute -translate-x-1/2 first:translate-x-0" style={{ left: pos(t) }}>
              {tickLabel(t)}
            </span>
          ))}
          <span className="absolute right-0">12a</span>
        </div>
      </div>
    </div>
  );
}
