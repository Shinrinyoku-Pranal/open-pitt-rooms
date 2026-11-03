"use client";

import { useEffect, useRef } from "react";
import {
  MIN_CAP_OPTIONS,
  MIN_FREE_OPTIONS,
  MIN_USEFUL_FREE_MIN,
  ROOM_TYPES,
  activeFilterCount,
  type FinderState,
  type RoomType,
  type SortMode,
} from "@/lib/finder";
import { FEATURES, type FeatureSlug } from "@/lib/rooms";
import { formatDuration } from "@/lib/time";
import { CheckIcon, StarIcon, XIcon } from "./icons";

type BuildingCount = { id: string; shortName: string; open: number };

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0 border-t border-line px-4 py-3.5 first:border-t-0">
      <div className="mb-2.5 flex items-baseline justify-between">
        <legend className="text-[12px] font-medium uppercase tracking-[0.08em] text-faint">{title}</legend>
        {aside}
      </div>
      {children}
    </fieldset>
  );
}

function Seg<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-xl bg-surface p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`flex-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-all ${
              active ? "bg-panel text-fg shadow-[0_1px_3px_rgb(0_0_0/0.2)]" : "text-muted hover:text-fg"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
        active ? "border-fg bg-fg text-bg" : "border-line-strong text-muted hover:border-fg/40 hover:text-fg"
      }`}
    >
      {active && <CheckIcon size={13} strokeWidth={2.5} />}
      {children}
    </button>
  );
}

// Preset options plus whatever value a typed query set, so it shows as selected.
function withCurrent(presets: readonly number[], current: number, label: (n: number) => string) {
  const values = presets.includes(current) ? [...presets] : [...presets, current].sort((a, b) => a - b);
  return values.map((v) => ({ value: v, label: label(v) }));
}

export default function FilterPanel({
  state,
  update,
  buildings,
  resultCount,
  onClose,
  onReset,
  onNearest,
}: {
  state: FinderState;
  update: (patch: Partial<FinderState>) => void;
  buildings: BuildingCount[];
  resultCount: number;
  onClose: () => void;
  onReset: () => void;
  onNearest: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleFeature = (f: FeatureSlug) =>
    update({ features: state.features.includes(f) ? state.features.filter((x) => x !== f) : [...state.features, f] });
  const toggleBuilding = (id: string) =>
    update({ buildings: state.buildings.includes(id) ? state.buildings.filter((b) => b !== id) : [...state.buildings, id] });
  const sortedBuildings = [...buildings].sort((a, b) => b.open - a.open || a.shortName.localeCompare(b.shortName));

  return (
    <div
      ref={panel}
      tabIndex={-1}
      role="dialog"
      aria-label="Filters"
      className="rise flex max-h-[min(70dvh,640px)] flex-col overflow-hidden rounded-2xl border border-line-strong bg-panel shadow-[var(--shadow)] outline-none"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[14px] font-semibold">Filters</h2>
        <button
          type="button"
          onClick={onClose}
          className="grid size-7 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
          aria-label="Close filters"
        >
          <XIcon size={16} />
        </button>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <Section title="Free for at least">
          <Seg
            label="Free for at least"
            value={state.minFree}
            onChange={(minFree) => update({ minFree })}
            options={withCurrent(MIN_FREE_OPTIONS, state.minFree, (m) =>
              m === 0 ? `${MIN_USEFUL_FREE_MIN}m` : formatDuration(m).replace(" hr", "h").replace(" min", "m"),
            )}
          />
        </Section>

        <Section title="Seats">
          <Seg
            label="Seats"
            value={state.minCap}
            onChange={(minCap) => update({ minCap })}
            options={withCurrent(MIN_CAP_OPTIONS, state.minCap, (c) => (c === 0 ? "Any" : `${c}+`))}
          />
        </Section>

        <Section title="Features">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(FEATURES) as FeatureSlug[]).map((f) => (
              <Toggle key={f} active={state.features.includes(f)} onClick={() => toggleFeature(f)}>
                {FEATURES[f]}
              </Toggle>
            ))}
          </div>
        </Section>

        <Section title="Room type">
          <Seg
            label="Room type"
            value={state.type}
            onChange={(type: RoomType) => update({ type })}
            options={(Object.keys(ROOM_TYPES) as RoomType[]).map((t) => ({
              value: t,
              label: t === "all" ? "All" : t === "nationality" ? "Nationality" : ROOM_TYPES[t],
            }))}
          />
        </Section>

        <Section
          title="Buildings"
          aside={
            state.buildings.length > 0 && (
              <button type="button" onClick={() => update({ buildings: [] })} className="text-[12px] font-medium text-muted hover:text-fg">
                Any building
              </button>
            )
          }
        >
          <div className="grid grid-cols-2 gap-1.5">
            {sortedBuildings.map((b) => {
              const active = state.buildings.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleBuilding(b.id)}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-[13px] transition-colors ${
                    active ? "border-fg bg-surface-2 text-fg" : "border-line text-muted hover:border-line-strong hover:text-fg"
                  }`}
                >
                  <span className="truncate font-medium">{b.shortName}</span>
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                      b.open > 0 ? "bg-free-soft text-free" : "text-faint"
                    }`}
                  >
                    {b.open}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Sort by">
          <Seg
            label="Sort by"
            value={state.sort}
            onChange={(sort: SortMode) => (sort === "nearest" ? onNearest() : update({ sort }))}
            options={[
              { value: "longest", label: "Free longest" },
              { value: "nearest", label: "Nearest" },
              { value: "building", label: "A–Z" },
            ]}
          />
        </Section>

        <Section title="Saved">
          <Toggle active={state.favoritesOnly} onClick={() => update({ favoritesOnly: !state.favoritesOnly })}>
            <StarIcon size={13} filled={state.favoritesOnly} /> Only my saved rooms
          </Toggle>
        </Section>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
        <button
          type="button"
          onClick={onReset}
          disabled={activeFilterCount(state) === 0}
          className="text-[13px] font-medium text-muted hover:text-fg disabled:opacity-40"
        >
          Reset all
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-primary px-4 py-2 text-[13.5px] font-medium text-primary-fg transition-opacity hover:opacity-90"
        >
          Show {resultCount} {resultCount === 1 ? "room" : "rooms"}
        </button>
      </div>
    </div>
  );
}
