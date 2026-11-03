import type { RoomStatus } from "./roomState";
import { DAY_END } from "./roomState";
import { formatClock, formatDuration } from "./time";

export const SHORT_FREE_MIN = 30;

export type StatusTone = "free" | "warn" | "busy" | "closed";

export function statusTone(s: RoomStatus): StatusTone {
  if (s.status === "free") return s.freeMin < SHORT_FREE_MIN ? "warn" : "free";
  return s.status;
}

export function statusHeadline(s: RoomStatus): string {
  switch (s.status) {
    case "free":
      return s.until >= DAY_END ? "Free rest of day" : `Free until ${formatClock(s.until)}`;
    case "busy":
      return s.freeAt !== null ? `In use until ${formatClock(s.freeAt)}` : "In use rest of day";
    case "closed":
      return s.freeAt !== null ? `Closed · opens ${formatClock(s.freeAt)}` : "Closed rest of day";
  }
}

export function statusDetail(s: RoomStatus): string | null {
  switch (s.status) {
    case "free": {
      const length = formatDuration(s.freeMin);
      if (s.until >= DAY_END) return `${length} left`;
      if (s.endsBecause === "closing") return `${length} · then closes`;
      return s.nextTitle && s.nextTitle !== "Reserved" ? `${length} · then ${s.nextTitle}` : `${length} · then reserved`;
    }
    case "busy":
      return s.title;
    case "closed":
      return null;
  }
}
