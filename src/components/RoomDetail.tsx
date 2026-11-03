"use client";

import { useState } from "react";
import type { RoomDTO } from "@/lib/data";
import type { EvaluatedRoom } from "@/lib/finder";
import { walkMinutes } from "@/lib/geo";
import { studyEventIcs } from "@/lib/ics";
import { FEATURES } from "@/lib/rooms";
import { statusDetail, statusHeadline, statusTone } from "@/lib/statusText";
import DayTimeline from "./DayTimeline";
import RoomWeek from "./RoomWeek";
import { TONE_TEXT } from "./RoomRow";
import { CalendarIcon, ExternalIcon, ShareIcon, StarIcon, WalkIcon, XIcon } from "./icons";

const KIND_NOTE: Record<RoomDTO["kind"], string | null> = {
  REGISTRAR: null,
  NATIONALITY: "Nationality Room. Please treat the space and its furnishings with care.",
  DEPARTMENTAL: "Departmental room. It may be locked or reserved for the department.",
};

export default function RoomDetail({
  item,
  day,
  today,
  atMin,
  nowMin,
  favorite,
  onFavorite,
  onClose,
  onJump,
  shareUrl,
}: {
  item: EvaluatedRoom<RoomDTO>;
  day: string;
  today: string;
  atMin: number;
  nowMin: number;
  favorite: boolean;
  onFavorite: () => void;
  onClose: () => void;
  onJump: (date: string, min: number) => void;
  shareUrl: string;
}) {
  const { room, building, status, distanceM } = item;
  const tone = statusTone(status);
  const detail = statusDetail(status);
  const [copied, setCopied] = useState(false);

  async function share() {
    const data = { title: room.displayName, text: `${room.displayName} · ${statusHeadline(status)}`, url: shareUrl };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  }

  // Saves the current free stretch as a calendar event (a reminder, not a booking).
  function addToCalendar() {
    if (status.status !== "free") return;
    const ics = studyEventIcs({
      roomId: room.id,
      title: room.displayName,
      location: `${building.name} ${room.roomNumber}, University of Pittsburgh`,
      date: day,
      startMin: atMin - (atMin % 5),
      endMin: status.until,
      url: room.url25Live,
    });
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${room.displayName.replace(/[^\w]+/g, "-")}.ics` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const iconButton = "grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg";
  const secondary =
    "inline-flex items-center justify-center gap-1.5 rounded-xl border border-line-strong px-2 py-2.5 text-[13px] font-medium transition-colors hover:bg-surface disabled:opacity-40 disabled:hover:bg-transparent";
  const meta = [
    `${building.shortName} ${room.roomNumber}`,
    room.capacity ? `${room.capacity} seats` : null,
    distanceM !== null ? `${walkMinutes(distanceM)} min walk` : null,
  ].filter(Boolean);

  return (
    <article className="rise" aria-label={room.displayName}>
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium uppercase tracking-[0.08em] text-faint">{building.name}</p>
          <h2 className="mt-0.5 text-xl font-semibold leading-tight tracking-tight">{room.displayName}</h2>
          <p className="mt-0.5 text-[13px] text-muted">{meta.join(" · ")}</p>
        </div>
        <button
          type="button"
          onClick={onFavorite}
          aria-pressed={favorite}
          aria-label={favorite ? "Unsave room" : "Save room"}
          className={`${iconButton} ${favorite ? "text-gold hover:text-gold" : ""}`}
        >
          <StarIcon filled={favorite} size={17} />
        </button>
        <button type="button" onClick={onClose} className={iconButton} aria-label="Close">
          <XIcon size={17} />
        </button>
      </header>

      <div className="mt-4 rounded-xl border border-line bg-surface/60 p-3.5">
        <p className={`text-[15px] font-semibold ${TONE_TEXT[tone]}`}>{statusHeadline(status)}</p>
        {detail && <p className="mt-0.5 text-[13px] text-muted">{detail}</p>}
        <div className="mt-3.5">
          <DayTimeline blocks={room.blocks} atMin={atMin} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <a
          href={room.url25Live}
          target="_blank"
          rel="noopener noreferrer"
          className="col-span-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-[13.5px] font-semibold text-primary-fg transition-opacity hover:opacity-90"
        >
          Confirm on 25Live <ExternalIcon size={14} />
        </a>
        <a
          href={`https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=${building.lat},${building.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className={secondary}
        >
          <WalkIcon size={15} />
          Walk
        </a>
        <button type="button" onClick={share} className={secondary}>
          <ShareIcon size={15} />
          {copied ? "Copied" : "Share"}
        </button>
        <button
          type="button"
          onClick={addToCalendar}
          disabled={status.status !== "free"}
          className={secondary}
          title={status.status === "free" ? "Save this free stretch to your calendar" : "Available when the room is free"}
        >
          <CalendarIcon size={15} />
          Calendar
        </button>
      </div>

      <section className="mt-5" aria-label="This week">
        <h3 className="mb-1.5 flex items-baseline justify-between px-2 text-[12px] font-medium uppercase tracking-[0.08em] text-faint">
          This week
          <span className="normal-case tracking-normal">tap a day to jump there</span>
        </h3>
        <RoomWeek roomId={room.id} today={today} activeDay={day} nowMin={nowMin} onJump={onJump} />
      </section>

      {room.features.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Room features">
          {room.features.map((f) => (
            <li key={f} className="rounded-md border border-line px-2 py-1 text-[12px] text-muted">
              {FEATURES[f]}
            </li>
          ))}
        </ul>
      )}

      {KIND_NOTE[room.kind] && <p className="mt-3 text-[12.5px] leading-relaxed text-muted">{KIND_NOTE[room.kind]}</p>}
      <p className="mt-3 text-[11.5px] leading-relaxed text-faint">{room.formalName}</p>
    </article>
  );
}
