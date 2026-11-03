"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { DayData, RoomWeekDTO } from "@/lib/data";
import type { LatLng } from "@/lib/geo";

// --- Live clock -------------------------------------------------------------

let clock = 0;
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | null = null;

function tick() {
  clock = Date.now();
  clockListeners.forEach((l) => l());
}

function onVisibility() {
  if (document.visibilityState === "visible") tick();
}

function subscribeClock(cb: () => void) {
  clock = Date.now();
  clockListeners.add(cb);
  if (!clockTimer) {
    clockTimer = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", onVisibility);
  }
  return () => {
    clockListeners.delete(cb);
    if (clockListeners.size === 0 && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}

// Current time, ticking every 30s. During SSR/hydration it's the server's render
// time (or null if unknown) so markup matches.
export function useNow(serverNow: number | null): number | null {
  return useSyncExternalStore(
    subscribeClock,
    () => clock || Date.now(),
    () => serverNow,
  );
}

// --- URL search params as state ---------------------------------------------

const urlListeners = new Set<() => void>();

function subscribeUrl(cb: () => void) {
  urlListeners.add(cb);
  window.addEventListener("popstate", cb);
  return () => {
    urlListeners.delete(cb);
    window.removeEventListener("popstate", cb);
  };
}

export function useSearchString(): string {
  return useSyncExternalStore(
    subscribeUrl,
    () => window.location.search,
    () => "",
  );
}

export function replaceSearchString(qs: string) {
  const next = qs ? `?${qs}` : window.location.pathname;
  if (next === window.location.search) return;
  window.history.replaceState(window.history.state, "", next);
  urlListeners.forEach((l) => l());
}

// --- Room data per day ------------------------------------------------------

const REFRESH_MS = 5 * 60_000;

function withoutKey<T>(obj: Record<string, T>, key: string): Record<string, T> {
  if (!(key in obj)) return obj;
  const next = { ...obj };
  delete next[key];
  return next;
}

// Per-day cache of /api/rooms responses, seeded with the server-rendered day and
// refreshed every few minutes while the tab is visible.
export function useDayData(initial: DayData | null, day: string | null) {
  const [cache, setCache] = useState<Record<string, DayData>>(() =>
    initial ? { [initial.date]: initial } : {},
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inflight = useRef<AbortController | null>(null);

  const load = useCallback(async (d: string) => {
    inflight.current?.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    try {
      const res = await fetch(`/api/rooms?date=${d}`, { signal: ctrl.signal });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      setCache((c) => ({ ...c, [d]: body as DayData }));
      setErrors((e) => withoutKey(e, d));
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setErrors((e) => ({ ...e, [d]: (err as Error).message || "Network error" }));
      }
    }
  }, []);

  const cached = day ? Boolean(cache[day]) : true;
  useEffect(() => {
    if (day && !cached) void load(day);
  }, [day, cached, load]);

  useEffect(() => {
    if (!day) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load(day);
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [day, load]);

  const data = day ? (cache[day] ?? null) : null;
  const error = day ? (errors[day] ?? null) : null;
  return {
    data,
    loading: Boolean(day) && !data && !error,
    error,
    retry: () => {
      if (!day) return;
      setErrors((e) => withoutKey(e, day));
      void load(day);
    },
  };
}

// --- Favorites (localStorage, synced across tabs) ---------------------------

const FAVORITES_KEY = "opr:favorites";
const favoriteListeners = new Set<() => void>();

function readFavorites(): string {
  try {
    return localStorage.getItem(FAVORITES_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribeFavorites(cb: () => void) {
  favoriteListeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === FAVORITES_KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    favoriteListeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useFavorites() {
  const raw = useSyncExternalStore(subscribeFavorites, readFavorites, () => "[]");
  const favorites = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []);
    } catch {
      return new Set<string>();
    }
  }, [raw]);

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(favorites);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      } catch {}
      favoriteListeners.forEach((l) => l());
    },
    [favorites],
  );
  return { favorites, toggle };
}

// --- Geolocation (on demand only; never leaves the device) -----------------

export function useUserLocation() {
  const [loc, setLoc] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "denied" | "unavailable">("idle");
  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    setStatus("pending");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("idle");
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 120_000 },
    );
  }, []);
  return { loc, status, request };
}

// --- Media queries ------------------------------------------------------------

export function useMediaQuery(query: string, serverValue: boolean): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => serverValue);
}

// --- Theme (system by default; a manual choice is remembered) ------------------

export type Theme = "light" | "dark";
const THEME_KEY = "opr:theme";
const themeListeners = new Set<() => void>();

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {}
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribeTheme(cb: () => void) {
  themeListeners.add(cb);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onStorage = (e: StorageEvent) => e.key === THEME_KEY && cb();
  mq.addEventListener("change", cb);
  window.addEventListener("storage", onStorage);
  return () => {
    themeListeners.delete(cb);
    mq.removeEventListener("change", cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, (): Theme => "dark");
  const setTheme = useCallback((t: Theme) => {
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {}
    document.documentElement.dataset.theme = t;
    themeListeners.forEach((l) => l());
  }, []);
  return { theme, setTheme };
}

// --- One room's week (for the room card) ------------------------------------------

const roomWeekCache = new Map<string, RoomWeekDTO>();

export function useRoomWeek(roomId: string) {
  const [week, setWeek] = useState<RoomWeekDTO | null>(() => roomWeekCache.get(roomId) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const cached = roomWeekCache.get(roomId);
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/room-week?room=${encodeURIComponent(roomId)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as RoomWeekDTO;
        roomWeekCache.set(roomId, body);
        setWeek(body);
        setFailed(false);
      } catch (err) {
        if ((err as Error).name !== "AbortError" && !cached) setFailed(true);
      }
    })();
    return () => ctrl.abort();
  }, [roomId]);

  return { week: week?.roomId === roomId ? week : (roomWeekCache.get(roomId) ?? null), failed };
}
