"use client";

import type { RoomDTO } from "@/lib/data";
import type { EvaluatedRoom } from "@/lib/finder";
import { walkMinutes } from "@/lib/geo";
import { statusTone, type StatusTone } from "@/lib/statusText";
import { formatClock } from "@/lib/time";
import { DAY_END } from "@/lib/roomState";
import { StarIcon } from "./icons";

// Green while a room is open, yellow when it closes within half an hour, red when it's
// in use or closed.
export const TONE_TEXT: Record<StatusTone, string> = {
  free: "text-free",
  warn: "text-warn",
  busy: "text-busy",
  closed: "text-busy",
};

const TONE_DOT: Record<StatusTone, string> = {
  free: "bg-free shadow-[0_0_10px_var(--free)]",
  warn: "bg-warn",
  busy: "bg-busy",
  closed: "bg-busy/70",
};

export function shortDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// One line of status for the list: "until 10 PM" over "7h 37m".
function rowStatus(item: EvaluatedRoom<RoomDTO>): [string, string | null] {
  const s = item.status;
  if (s.status === "free") return [s.until >= DAY_END ? "rest of day" : `until ${formatClock(s.until)}`, shortDuration(s.freeMin)];
  if (s.status === "busy") return [s.freeAt !== null ? `free at ${formatClock(s.freeAt)}` : "busy all day", s.title];
  return [s.freeAt !== null ? `opens ${formatClock(s.freeAt)}` : "closed", null];
}

export default function RoomRow({
  item,
  selected,
  favorite,
  onSelect,
  onHover,
  onFavorite,
}: {
  item: EvaluatedRoom<RoomDTO>;
  selected: boolean;
  favorite: boolean;
  onSelect: () => void;
  onHover: (buildingId: string | null) => void;
  onFavorite: () => void;
}) {
  const { room, building, distanceM } = item;
  const tone = statusTone(item.status);
  const [main, sub] = rowStatus(item);
  const generic = room.displayName === `${building.shortName} ${room.roomNumber}`;
  const meta = [
    generic ? building.name : `${building.shortName} ${room.roomNumber}`,
    room.capacity ? `${room.capacity} seats` : null,
    distanceM !== null ? `${walkMinutes(distanceM)} min walk` : null,
  ].filter(Boolean);

  return (
    <li
      className="group relative"
      onMouseEnter={() => onHover(building.id)}
      onMouseLeave={() => onHover(null)}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 pr-10 text-left transition-colors ${
          selected ? "bg-surface-2" : "hover:bg-surface"
        }`}
      >
        <span className={`size-2 shrink-0 rounded-full ${TONE_DOT[tone]}`} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[14px] font-medium leading-snug">{room.displayName}</span>
            {room.kind === "DEPARTMENTAL" && (
              <span
                className="shrink-0 rounded bg-warn-soft px-1 py-px text-[10px] font-bold uppercase tracking-wide text-warn"
                title="Departmental room: may be locked or reserved for the department"
              >
                Dept
              </span>
            )}
          </span>
          <span className="block truncate text-[12.5px] leading-snug text-muted">{meta.join(" · ")}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className={`block text-[13px] font-medium leading-snug ${TONE_TEXT[tone]}`}>{main}</span>
          {sub && <span className="block max-w-[7.5rem] truncate text-[12px] leading-snug tabular-nums text-faint">{sub}</span>}
        </span>
      </button>
      <button
        type="button"
        onClick={onFavorite}
        aria-pressed={favorite}
        aria-label={favorite ? `Unsave ${room.displayName}` : `Save ${room.displayName}`}
        className={`absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg transition hover:bg-surface-2 ${
          favorite ? "text-gold" : "text-faint opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
        }`}
      >
        <StarIcon filled={favorite} size={15} />
      </button>
    </li>
  );
}
