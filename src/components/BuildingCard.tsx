"use client";

import type { BuildingDTO, RoomDTO } from "@/lib/data";
import type { EvaluatedRoom } from "@/lib/finder";
import { formatClock } from "@/lib/time";
import RoomRow from "./RoomRow";
import { WalkIcon, XIcon } from "./icons";

const LATER_SHOWN = 5;

// What opens when a building's circle on the map is clicked: how many rooms are open,
// which ones, and when the next ones free up.
export default function BuildingCard({
  building,
  total,
  open,
  later,
  whenPhrase,
  selectedId,
  favorites,
  onSelectRoom,
  onFavorite,
  onClose,
}: {
  building: BuildingDTO;
  total: number;
  open: EvaluatedRoom<RoomDTO>[];
  later: EvaluatedRoom<RoomDTO>[];
  whenPhrase: string;
  selectedId: string | null;
  favorites: Set<string>;
  onSelectRoom: (id: string) => void;
  onFavorite: (id: string) => void;
  onClose: () => void;
}) {
  const nextOpen = later
    .map((r) => (r.status.status === "free" ? null : r.status.freeAt))
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b)[0];
  const row = (item: EvaluatedRoom<RoomDTO>) => (
    <RoomRow
      key={item.room.id}
      item={item}
      selected={selectedId === item.room.id}
      favorite={favorites.has(item.room.id)}
      onSelect={() => onSelectRoom(item.room.id)}
      onHover={() => {}}
      onFavorite={() => onFavorite(item.room.id)}
    />
  );

  return (
    <article className="rise" aria-label={building.name}>
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-faint">Building</p>
          <h2 className="mt-0.5 text-xl font-semibold leading-tight tracking-tight">{building.name}</h2>
          <p className="mt-1 text-[13px] text-muted">
            <span className={`font-semibold ${open.length ? "text-free" : "text-busy"}`}>
              {open.length} of {total} rooms open
            </span>{" "}
            {whenPhrase}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          aria-label="Close"
        >
          <XIcon size={17} />
        </button>
      </header>

      <a
        href={`https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=${building.lat},${building.lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-line-strong px-3 py-2 text-[13px] font-medium transition-colors hover:bg-surface"
      >
        <WalkIcon size={15} /> Walking directions
      </a>

      <section className="mt-4" aria-label="Open rooms">
        <h3 className="mb-1 px-1 text-[12px] font-medium uppercase tracking-[0.08em] text-faint">Open now · pick a room</h3>
        {open.length ? (
          <ul className="-mx-2 grid grid-cols-1 gap-0.5">{open.map(row)}</ul>
        ) : (
          <p className="rounded-xl bg-surface px-3 py-2.5 text-[13px] text-muted">
            Nothing here matches {whenPhrase}.
            {nextOpen !== undefined && <> The next room opens at {formatClock(nextOpen)}.</>}
          </p>
        )}
      </section>

      {later.length > 0 && (
        <section className="mt-4" aria-label="Opening later">
          <h3 className="mb-1 px-1 text-[12px] font-medium uppercase tracking-[0.08em] text-faint">
            Opening later{later.length > LATER_SHOWN && ` · first ${LATER_SHOWN}`}
          </h3>
          <ul className="-mx-2 grid grid-cols-1 gap-0.5">{later.slice(0, LATER_SHOWN).map(row)}</ul>
        </section>
      )}
    </article>
  );
}
