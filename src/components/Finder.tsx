"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { DayData, RoomDTO } from "@/lib/data";
import {
  DEFAULT_STATE,
  activeFilterCount,
  evaluateRooms,
  parseFinderState,
  serializeFinderState,
  type EvaluatedRoom,
  type FinderState,
  type SortMode,
} from "@/lib/finder";
import { describeFilters, filterTokens } from "@/lib/answer";
import { parseQuery } from "@/lib/query";
import { roomStatusAt } from "@/lib/roomState";
import { busiestWindow, dashboardStats, openTimeline } from "@/lib/stats";
import { BUILDINGS, CAMPUS_CENTER, NEAR_CAMPUS_M } from "@/lib/buildings";
import { distanceMeters } from "@/lib/geo";
import { addDays, dayLabel, formatClock, formatDuration, parseHHMM, pittDateISO, pittMinutesOfDay, toHHMM } from "@/lib/time";
import {
  replaceSearchString,
  useDayData,
  useFavorites,
  useMediaQuery,
  useNow,
  useSearchString,
  useTheme,
  useUserLocation,
} from "./hooks";
import FilterPanel from "./FilterPanel";
import RoomDetail from "./RoomDetail";
import RoomRow from "./RoomRow";
import { Badge, NavRow, SectionLabel, Switch } from "./Sidebar";
import TimeScrubber from "./TimeScrubber";
import {
  BoardIcon,
  BuildingIcon,
  ChevronIcon,
  ClockIcon,
  DoorIcon,
  GlobeIcon,
  HourglassIcon,
  InfoIcon,
  MoonIcon,
  SearchIcon,
  SlidersIcon,
  StarIcon,
  TableIcon,
  UsersIcon,
  XIcon,
} from "./icons";

const BuildingMap = dynamic(() => import("./BuildingMap"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-surface" />,
});

const BUILDING_IDS = new Set(BUILDINGS.map((b) => b.id));
const SHORT_NAMES = new Map(BUILDINGS.map((b) => [b.id, b.shortName]));
const buildingName = (id: string) => SHORT_NAMES.get(id) ?? id;

// Desktop layout geometry, shared by the layout and the map camera.
const SIDEBAR_W = 300;
const GUTTER = 12;
const SCRUBBER_H = 150;
const DETAIL_W = 380;

function relativeMinutes(iso: string | null, now: number | null): string {
  if (!iso) return "never";
  if (now === null) return "recently";
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  return `${formatDuration(mins).replace(/ \d+ min$/, "")} ago`;
}

function quickFilters(state: FinderState): { key: string; label: string; icon: React.ReactNode; patch: Partial<FinderState>; active: boolean }[] {
  const has = (f: "whiteboard" | "tables") => state.features.includes(f);
  const toggle = (f: "whiteboard" | "tables") => ({
    features: has(f) ? state.features.filter((x) => x !== f) : [...state.features, f],
  });
  return [
    { key: "wb", label: "Whiteboard", icon: <BoardIcon size={16} />, patch: toggle("whiteboard"), active: has("whiteboard") },
    { key: "tables", label: "Tables", icon: <TableIcon size={16} />, patch: toggle("tables"), active: has("tables") },
    { key: "group", label: "Groups of 25+", icon: <UsersIcon size={16} />, patch: { minCap: state.minCap === 25 ? 0 : 25 }, active: state.minCap === 25 },
    {
      key: "nat",
      label: "Nationality Rooms",
      icon: <GlobeIcon size={16} />,
      patch: { type: state.type === "nationality" ? "all" : "nationality" },
      active: state.type === "nationality",
    },
    { key: "saved", label: "Saved rooms", icon: <StarIcon size={16} />, patch: { favoritesOnly: !state.favoritesOnly }, active: state.favoritesOnly },
  ];
}

export default function Finder({ initialData }: { initialData: DayData | null }) {
  const now = useNow(initialData?.generatedAt ?? null);
  const clientToday = now === null ? null : pittDateISO(new Date(now));
  const search = useSearchString();
  const state = useMemo(() => parseFinderState(new URLSearchParams(search), BUILDING_IDS), [search]);
  const { favorites, toggle: toggleFavorite } = useFavorites();
  const { theme, setTheme } = useTheme();
  const location = useUserLocation();
  // Walking times and nearest-first only make sense near campus.
  const nearLoc = location.loc && distanceMeters(location.loc, CAMPUS_CENTER) <= NEAR_CAMPUS_M ? location.loc : null;
  const isDesktop = useMediaQuery("(min-width: 1024px)", true);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [draft, setDraft] = useState("");
  const [prompt, setPrompt] = useState<{ text: string; ignored: string[] } | null>(null);
  const [dismissedNotice, setDismissedNotice] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const dates = useMemo(
    () => (clientToday ? Array.from({ length: 7 }, (_, i) => addDays(clientToday, i)) : []),
    [clientToday],
  );
  const day = state.date && dates.includes(state.date) ? state.date : clientToday;
  const isToday = day === clientToday;
  const isLive = isToday && !state.time;
  const nowMin = now === null ? 0 : pittMinutesOfDay(new Date(now));
  const atMin = state.time ? parseHHMM(state.time) : nowMin;

  const { data, loading, error, retry } = useDayData(initialData, day);
  const update = useCallback(
    (patch: Partial<FinderState>) => replaceSearchString(serializeFinderState({ ...state, ...patch })),
    [state],
  );
  const closeFilters = useCallback(() => setFiltersOpen(false), []);

  const evaluate = useCallback(
    (s: FinderState) =>
      data
        ? evaluateRooms<RoomDTO>({ rooms: data.rooms, buildings: data.buildings, atMin, state: s, userLoc: nearLoc, favorites })
        : { available: [], unavailable: [] },
    [data, atMin, nearLoc, favorites],
  );

  const result = useMemo(() => (data ? evaluate(state) : null), [data, evaluate, state]);
  const stats = useMemo(
    () => (data ? dashboardStats({ rooms: data.rooms, buildings: data.buildings, atMin, state, favorites }) : null),
    [data, atMin, state, favorites],
  );
  const busiest = useMemo(() => (data ? busiestWindow(data.rooms) : null), [data]);

  // The scrubber's chart doesn't depend on the chosen time, so scrubbing doesn't recompute it.
  const timelineKey = serializeFinderState({ ...state, time: null, room: null, sort: "longest" });
  const timeline = useMemo(
    () =>
      data
        ? openTimeline({
            rooms: data.rooms,
            buildings: data.buildings,
            state: parseFinderState(new URLSearchParams(timelineKey), BUILDING_IDS),
            favorites,
          })
        : [],
    [data, timelineKey, favorites],
  );

  // Per-building counts honour every filter except the building filter itself.
  const mapBuildings = useMemo(() => {
    if (!data) return [];
    const all = evaluate({ ...state, buildings: [] });
    const open = new Map<string, number>();
    for (const r of all.available) open.set(r.building.id, (open.get(r.building.id) ?? 0) + 1);
    return data.buildings
      .map((b) => ({ ...b, open: open.get(b.id) ?? 0, total: data.rooms.filter((r) => r.buildingId === b.id).length }))
      .filter((b) => b.total > 0);
  }, [data, evaluate, state]);

  const quick = useMemo(
    () =>
      quickFilters(state).map((q) => ({
        ...q,
        count: q.active ? (result?.available.length ?? 0) : evaluate({ ...state, ...q.patch }).available.length,
      })),
    [state, result, evaluate],
  );

  // The selected room stays viewable even if the current filters hide it (shared links).
  const selected = useMemo((): EvaluatedRoom<RoomDTO> | null => {
    if (!data || !state.room) return null;
    const room = data.rooms.find((r) => r.id === state.room);
    const building = room && data.buildings.find((b) => b.id === room.buildingId);
    if (!room || !building) return null;
    return {
      room,
      building,
      status: roomStatusAt(room.blocks, atMin),
      distanceM: nearLoc ? distanceMeters(nearLoc, building) : null,
    };
  }, [data, state.room, atMin, nearLoc]);

  // --- Search ------------------------------------------------------------------------
  const searchable = useMemo(
    () => (data ? data.rooms.map((r) => `${r.displayName} ${r.code} ${r.roomNumber}`).join(" ").toLowerCase() : ""),
    [data],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable;
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const runQuery = () => {
    const t = draft.trim();
    if (!t || !clientToday) return;
    const { patch, ignored } = parseQuery(t, { today: clientToday, buildings: BUILDINGS, knownTerm: (w) => searchable.includes(w) });
    const next: FinderState = { ...DEFAULT_STATE, ...patch };
    if (next.sort === "nearest" && !location.loc) location.request();
    replaceSearchString(serializeFinderState(next));
    setPrompt({ text: t, ignored });
    setDraft("");
    input.current?.blur();
  };

  const clearAll = () => {
    replaceSearchString("");
    setPrompt(null);
  };
  const selectRoom = (id: string) => update({ room: state.room === id ? null : id });
  const setSort = (sort: SortMode) => {
    if (sort === "nearest" && !location.loc) location.request();
    update({ sort });
  };

  // --- Labels --------------------------------------------------------------------------
  const tomorrow = clientToday ? addDays(clientToday, 1) : null;
  const clock = formatClock(atMin);
  const whenPhrase = isLive
    ? "right now"
    : isToday
      ? `today at ${clock}`
      : day === tomorrow
        ? `tomorrow at ${clock}`
        : `on ${dayLabel(day ?? "", clientToday ?? "")} at ${clock}`;
  const tokens = filterTokens(state, { whenLabel: null, buildingName });
  const filterCount = activeFilterCount(state);
  const count = result?.available.length ?? 0;
  const description = describeFilters(state, buildingName);
  const synced = relativeMinutes(data?.lastSyncedAt ?? null, now);
  const delta = stats ? stats.open - stats.openHourAgo : 0;
  const shareUrlFor = (roomId: string) => {
    const qs = serializeFinderState({ ...DEFAULT_STATE, date: state.date, time: state.time, room: roomId });
    return `${typeof window === "undefined" ? "" : window.location.origin}/?${qs}`;
  };

  const focus = selected
    ? { id: selected.building.id, lat: selected.building.lat, lng: selected.building.lng }
    : state.buildings.length === 1
      ? (BUILDINGS.find((b) => b.id === state.buildings[0]) ?? null)
      : null;
  // Centre focused buildings in the part of the map the overlays leave visible.
  const rightCover = selected ? DETAIL_W + GUTTER * 2 : 0;
  const focusOffset: [number, number] = isDesktop ? [rightCover / 2, SCRUBBER_H / 2] : [0, 0];
  const inClassPct = stats && stats.total ? Math.round((stats.inClass / stats.total) * 100) : 0;

  // What the locate button found, when it isn't simply "here you are".
  const awayKm = location.loc ? distanceMeters(location.loc, CAMPUS_CENTER) / 1000 : 0;
  const locationNotice =
    location.status === "denied"
      ? "Location is blocked for this site. Allow it in your browser's site settings, then tap the arrow again."
      : location.status === "unavailable"
        ? "Couldn't get your location. Check that location services are on for your browser."
        : location.loc && awayKm * 1000 > NEAR_CAMPUS_M
          ? `You're about ${Math.round(awayKm)} km from campus, so the map stays on Pitt and walking times are hidden.`
          : null;
  const locate = () => {
    setDismissedNotice(null);
    location.request();
  };

  const detail = selected && day && clientToday && (
    <RoomDetail
      key={selected.room.id}
      item={selected}
      day={day}
      today={clientToday}
      atMin={atMin}
      nowMin={nowMin}
      favorite={favorites.has(selected.room.id)}
      onFavorite={() => toggleFavorite(selected.room.id)}
      onClose={() => update({ room: null })}
      onJump={(date, min) => update({ date: date === clientToday ? null : date, time: toHHMM(min) })}
      shareUrl={shareUrlFor(selected.room.id)}
    />
  );

  const scrubber = clientToday && day && (
    <TimeScrubber
      dates={dates}
      today={clientToday}
      day={day}
      onDay={(d) =>
        update({
          date: d === clientToday ? null : d,
          time: d === clientToday ? state.time : (state.time ?? toHHMM(nowMin - (nowMin % 15))),
        })
      }
      series={timeline}
      atMin={atMin}
      nowMin={isToday ? nowMin : null}
      isLive={isLive}
      onTime={(min) => update({ time: toHHMM(min) })}
      onNow={() => update({ date: null, time: null })}
      busiest={busiest}
      openNow={count}
    />
  );

  const roomRow = (item: EvaluatedRoom<RoomDTO>) => (
    <RoomRow
      key={item.room.id}
      item={item}
      selected={state.room === item.room.id}
      favorite={favorites.has(item.room.id)}
      onSelect={() => selectRoom(item.room.id)}
      onHover={setHovered}
      onFavorite={() => toggleFavorite(item.room.id)}
    />
  );

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-bg lg:block">
      {/* The campus map fills everything right of the sidebar. */}
      <div className="relative h-[42dvh] shrink-0 lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto" style={isDesktop ? { left: SIDEBAR_W } : undefined}>
        <BuildingMap
          buildings={mapBuildings}
          selected={state.buildings}
          highlighted={hovered ?? selected?.building.id ?? null}
          focus={focus}
          focusOffset={focusOffset}
          fitPadding={isDesktop ? [56, GUTTER * 3, SCRUBBER_H + GUTTER * 3, GUTTER * 3] : [52, 16, 40, 16]}
          onBuildingClick={(id) =>
            update({
              buildings: state.buildings.includes(id) ? state.buildings.filter((b) => b !== id) : [id],
              room: null,
            })
          }
          userLoc={location.loc}
          onLocate={locate}
          locating={location.status === "pending"}
          notice={locationNotice !== dismissedNotice ? locationNotice : null}
          onDismissNotice={() => setDismissedNotice(locationNotice)}
          controlsBottom={isDesktop ? SCRUBBER_H + GUTTER * 2 : 32}
          controlsRight={isDesktop && selected ? DETAIL_W + GUTTER * 2 : GUTTER}
        />
        <div className="glass pointer-events-none absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex items-center gap-2 rounded-full py-1.5 pl-3 pr-3.5 text-[13px] lg:hidden">
          <span className={`size-2 rounded-full ${isLive ? "animate-pulse bg-free" : "bg-accent"}`} />
          <span className="font-mono font-semibold">{count}</span>
          <span className="text-muted">open {isLive ? "now" : `at ${clock}`}</span>
        </div>
      </div>

      {/* Sidebar: full height on desktop, a sheet under the map on phones. */}
      <section
        aria-label="Room finder"
        className="scroll-thin relative z-20 -mt-5 flex min-h-0 flex-1 flex-col overflow-y-auto rounded-t-[26px] border-t border-line-strong bg-panel shadow-[0_-16px_48px_rgb(0_0_0/0.4)] lg:absolute lg:inset-y-0 lg:left-0 lg:mt-0 lg:overflow-hidden lg:rounded-none lg:border-r lg:border-t-0 lg:border-line lg:shadow-none"
        style={isDesktop ? { width: SIDEBAR_W } : undefined}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong lg:hidden" aria-hidden="true" />

        {/* Brand, building and search */}
        <div className="shrink-0 px-3 pb-1 pt-3 lg:pt-4">
          <div className="flex items-center gap-3 px-1">
            <Image src="/logo.png" alt="" width={40} height={40} priority className="size-10 rounded-xl ring-1 ring-line-strong" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-[15.5px] font-semibold tracking-tight">Open Pitt Rooms</p>
              <p className="text-[12px] text-faint">Study space finder</p>
            </div>
          </div>

          <label className="relative mt-4 flex items-center gap-2.5 rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-[13.5px] font-medium">
            <BuildingIcon size={16} className="shrink-0 text-muted" />
            <span className="sr-only">Building</span>
            <select
              value={state.buildings.length === 1 ? state.buildings[0] : ""}
              onChange={(e) => update({ buildings: e.target.value ? [e.target.value] : [], room: null })}
              className="min-w-0 flex-1 appearance-none bg-transparent pr-6 outline-none"
            >
              <option value="">All buildings</option>
              {[...mapBuildings]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.open} open)
                  </option>
                ))}
            </select>
            <ChevronIcon size={15} className="pointer-events-none absolute right-3 text-muted" />
          </label>

          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              runQuery();
            }}
            className="mt-2 flex h-10 items-center gap-2.5 rounded-xl border border-line bg-surface/60 px-3 transition-colors focus-within:border-accent/60"
          >
            <SearchIcon size={15} className="shrink-0 text-faint" />
            <label htmlFor="ask" className="sr-only">
              Describe the room you need
            </label>
            <input
              ref={input}
              id="ask"
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 160))}
              placeholder="Ask: whiteboard for 2 hrs…"
              autoComplete="off"
              enterKeyHint="search"
              className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-faint focus-visible:outline-none"
            />
            <kbd className="hidden shrink-0 rounded-md border border-line-strong px-1.5 py-0.5 font-mono text-[10.5px] text-muted lg:block">
              ⌘K
            </kbd>
          </form>
        </div>

        <div className="px-3 pb-3 lg:scroll-thin lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {(prompt || tokens.length > 0) && result && (
            <div className="rise mt-3 rounded-xl border border-line bg-surface p-3 text-[12.5px]">
              {prompt && <p className="mb-1 text-faint">“{prompt.text}”</p>}
              <p className="text-muted">
                <span className="font-semibold text-fg">
                  {count} open {count === 1 ? "room" : "rooms"}
                </span>
                {description && ` ${description},`} {whenPhrase}.
                {prompt && prompt.ignored.length > 0 && <> Didn&apos;t understand {prompt.ignored.map((w) => `“${w}”`).join(", ")}.</>}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {tokens.map((t) => (
                  <span key={t.key} className="inline-flex h-6 items-center gap-0.5 rounded-md border border-line-strong bg-panel pl-2 pr-0.5 text-[12px] font-medium">
                    {t.label}
                    <button
                      type="button"
                      onClick={() => update(t.clear)}
                      className="grid size-5 place-items-center rounded text-muted hover:text-fg"
                      aria-label={`Remove ${t.label}`}
                    >
                      <XIcon size={11} strokeWidth={2.5} />
                    </button>
                  </span>
                ))}
                <button type="button" onClick={clearAll} className="px-1 text-[12px] font-medium text-muted hover:text-fg">
                  Clear
                </button>
              </div>
            </div>
          )}

          {data?.stale && (
            <p role="status" className="mt-3 rounded-xl bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
              The schedule hasn&apos;t refreshed since {synced}. Double-check on 25Live.
            </p>
          )}

          <SectionLabel
            aside={
              stats &&
              delta !== 0 && (
                <span className={`font-mono text-[11px] font-semibold ${delta > 0 ? "text-free" : "text-busy"}`} title="Compared with an hour earlier">
                  {delta > 0 ? "↑" : "↓"} {Math.abs(delta)} vs 1h ago
                </span>
              )
            }
          >
            Overview
          </SectionLabel>
          <NavRow
            icon={<DoorIcon size={16} />}
            label={isLive ? "Open now" : `Open ${whenPhrase}`}
            active={isLive}
            onClick={isLive ? undefined : () => update({ date: null, time: null })}
            hint={isLive ? undefined : "Tap to go back to now"}
            badge={<Badge tone="free">{stats ? stats.open : "–"}</Badge>}
          />
          <NavRow
            icon={<HourglassIcon size={16} />}
            label="Free 2+ hours"
            active={state.minFree === 120}
            onClick={() => update({ minFree: state.minFree === 120 ? 0 : 120 })}
            badge={<Badge tone={state.minFree === 120 ? "active" : "plain"}>{stats?.longFree ?? "–"}</Badge>}
          />
          <NavRow
            icon={<ClockIcon size={16} />}
            label="Opening within 30 min"
            hint={stats?.soonNext != null ? `First at ${formatClock(stats.soonNext)}` : undefined}
            onClick={stats?.soonNext != null ? () => update({ time: toHHMM(stats.soonNext!) }) : undefined}
            badge={<Badge>{stats?.soon ?? "–"}</Badge>}
          />
          <NavRow icon={<UsersIcon size={16} />} label="In class" badge={<Badge>{inClassPct}%</Badge>} />

          {/* The scrubber lives in the sheet on phones */}
          <div className="mt-4 rounded-xl border border-line p-3 lg:hidden">{scrubber}</div>

          <SectionLabel
            aside={
              filterCount > 0 && (
                <button type="button" onClick={clearAll} className="text-[12px] font-medium text-muted hover:text-fg">
                  Clear all
                </button>
              )
            }
          >
            Filters
          </SectionLabel>
          {quick.map((q) => (
            <NavRow
              key={q.key}
              icon={q.icon}
              label={q.label}
              active={q.active}
              onClick={() => update(q.patch)}
              badge={<Badge tone={q.active ? "active" : "plain"}>{q.count}</Badge>}
            />
          ))}
          <NavRow
            icon={<SlidersIcon size={16} />}
            label="More filters"
            hint="Time, seats, features, buildings"
            active={filtersOpen}
            onClick={() => setFiltersOpen((v) => !v)}
            badge={filterCount > 0 ? <Badge tone="accent">{filterCount}</Badge> : <ChevronIcon size={15} className="-rotate-90 text-faint" />}
          />

          <SectionLabel
            aside={
              <label className="relative flex items-center text-[12px] text-muted">
                <span className="sr-only">Sort</span>
                <select
                  value={state.sort}
                  onChange={(e) => setSort(e.target.value as SortMode)}
                  className="appearance-none bg-transparent pr-4 text-right font-medium text-fg outline-none"
                >
                  <option value="longest">Free longest</option>
                  <option value="nearest">Nearest</option>
                  <option value="building">A–Z</option>
                </select>
                <ChevronIcon size={13} className="pointer-events-none absolute right-0" />
              </label>
            }
          >
            Rooms · <span className="font-mono">{count}</span> open
          </SectionLabel>

          {state.sort === "nearest" && !nearLoc && (
            <p className="px-2.5 pb-1 text-[12px] text-muted">
              {location.status === "pending"
                ? "Finding your location…"
                : location.loc
                  ? "You're not near campus, so these are sorted by free time."
                  : location.status === "denied"
                  ? "Location is off, so these are sorted by free time."
                  : location.status === "unavailable"
                    ? "Couldn't get your location, so these are sorted by free time."
                    : (
                      <button type="button" onClick={location.request} className="font-medium text-fg underline underline-offset-4">
                        Share your location to sort by distance
                      </button>
                    )}
            </p>
          )}

          {error && !data ? (
            <div className="p-4 text-center text-[13px]">
              <p>Couldn&apos;t reach the schedule.</p>
              <button type="button" onClick={retry} className="mt-3 rounded-xl bg-primary px-3.5 py-2 font-medium text-primary-fg">
                Try again
              </button>
            </div>
          ) : !result || loading ? (
            <div className="grid gap-1.5" aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-surface" />
              ))}
            </div>
          ) : !data?.hasData ? (
            <p className="p-4 text-center text-[13px] text-muted">Schedules for this day haven&apos;t loaded yet.</p>
          ) : (
            <>
              {result.available.length === 0 ? (
                <p className="px-2.5 py-3 text-[13px] text-muted">
                  Nothing matches {whenPhrase}.
                  {(filterCount > 0 || state.q) && (
                    <button type="button" onClick={clearAll} className="ml-1.5 font-medium text-fg underline underline-offset-4">
                      Clear filters
                    </button>
                  )}
                </p>
              ) : (
                <ul className="grid grid-cols-1 gap-0.5" aria-label="Open rooms">
                  {result.available.map(roomRow)}
                </ul>
              )}
              {result.unavailable.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowUnavailable((v) => !v)}
                    aria-expanded={showUnavailable}
                    className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] font-medium text-muted hover:bg-surface hover:text-fg"
                  >
                    <ChevronIcon size={14} className={`transition-transform ${showUnavailable ? "" : "-rotate-90"}`} />
                    {result.unavailable.length} busy, closed, or free only briefly
                  </button>
                  {showUnavailable && (
                    <ul className="grid grid-cols-1 gap-0.5" aria-label="Unavailable rooms">
                      {result.unavailable.map(roomRow)}
                    </ul>
                  )}
                </>
              )}
            </>
          )}
          <p className="px-2.5 pt-4 text-[11px] leading-relaxed text-faint">
            Open means no class on Pitt&apos;s 25Live schedule, not that the room is unlocked or empty. Not affiliated with
            the University of Pittsburgh.
          </p>
        </div>

        {/* Footer: theme, about, and where the data comes from */}
        <div className="shrink-0 border-t border-line px-3 py-3">
          <div className="flex items-center gap-3 px-2.5 py-1.5 text-[13.5px] text-muted">
            <MoonIcon size={16} className="text-faint" />
            <span className="flex-1">Dark mode</span>
            <Switch on={theme === "dark"} onChange={(on) => setTheme(on ? "dark" : "light")} label="Dark mode" />
          </div>
          <Link
            href="/about"
            className="flex items-center gap-3 rounded-lg px-2.5 py-1.5 text-[13.5px] text-muted transition-colors hover:bg-surface hover:text-fg"
          >
            <InfoIcon size={16} className="text-faint" />
            About &amp; privacy
          </Link>
          <div className="mt-2 flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
            <Image src="/logo.png" alt="" width={32} height={32} className="size-8 rounded-lg" />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-medium">Pitt 25Live schedule</span>
              <span className="block truncate text-[12px] text-faint">Synced {synced}</span>
            </span>
            <span className={`size-2 shrink-0 rounded-full ${data?.stale ? "bg-warn" : "bg-free shadow-[0_0_10px_var(--free)]"}`} />
          </div>
        </div>
      </section>

      {/* More filters: beside the sidebar on desktop, a sheet on phones */}
      {filtersOpen && (
        <>
          <div className="fixed inset-0 z-[1550] bg-black/30 lg:bg-transparent" onClick={closeFilters} aria-hidden="true" />
          <div
            className="fixed inset-x-3 bottom-3 z-[1560] lg:absolute lg:bottom-auto lg:top-3 lg:w-[380px]"
            style={isDesktop ? { left: SIDEBAR_W + GUTTER } : undefined}
          >
            <FilterPanel
              state={state}
              update={update}
              buildings={mapBuildings}
              resultCount={count}
              onClose={closeFilters}
              onReset={clearAll}
              onNearest={() => setSort("nearest")}
            />
          </div>
        </>
      )}

      {/* Desktop: the time scrubber floats along the bottom of the map */}
      <div
        className="glass absolute bottom-3 right-3 z-10 hidden rounded-[20px] px-4 pb-2.5 pt-3 lg:block"
        style={{ left: SIDEBAR_W + GUTTER, height: SCRUBBER_H }}
      >
        {scrubber}
      </div>

      {/* Selected room: a card over the map on desktop, a sheet on phones */}
      {selected && isDesktop && (
        <div
          className="glass scroll-thin absolute right-3 top-12 z-20 overflow-y-auto rounded-[22px] p-5"
          style={{ width: DETAIL_W, bottom: SCRUBBER_H + GUTTER * 2 }}
        >
          {detail}
        </div>
      )}
      {selected && !isDesktop && (
        <>
          <div className="fixed inset-0 z-[1500] bg-black/50 backdrop-blur-sm" onClick={() => update({ room: null })} aria-hidden="true" />
          <div className="scroll-thin fixed inset-x-0 bottom-0 z-[1501] max-h-[86dvh] overflow-y-auto rounded-t-3xl border-t border-line-strong bg-panel p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" />
            {detail}
          </div>
        </>
      )}
    </div>
  );
}
