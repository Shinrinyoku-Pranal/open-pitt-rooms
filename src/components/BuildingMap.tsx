"use client";

import { useEffect, useRef, useState } from "react";
import { AttributionControl, LngLatBounds, Map as MapLibre, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BUILDINGS, CAMPUS_CENTER, NEAR_CAMPUS_M } from "@/lib/buildings";
import { distanceMeters, type LatLng } from "@/lib/geo";
import ControlBar from "./ControlBar";
import { XIcon } from "./icons";
import { useTheme } from "./hooks";

// OpenFreeMap: free vector tiles from OpenStreetMap data, no API key or usage limits.
const STYLE = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/positron",
};

const CAMPUS_BOUNDS = BUILDINGS.reduce(
  (b, { lat, lng }) => b.extend([lng, lat]),
  new LngLatBounds([BUILDINGS[0].lng, BUILDINGS[0].lat], [BUILDINGS[0].lng, BUILDINGS[0].lat]),
);
const FOCUS_ZOOM = 17.2;
const TILT = 52;
const BEARING = -18; // Lines the map up with Forbes and Fifth.

export type MapBuilding = {
  id: string;
  shortName: string;
  lat: number;
  lng: number;
  open: number;
  total: number;
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function pinHtml(b: MapBuilding, s: { selected: boolean; highlighted: boolean; dimmed: boolean }) {
  const cls = [
    "opr-pin",
    b.open > 0 ? "is-open" : "is-empty",
    s.selected && "is-selected",
    s.highlighted && "is-highlighted",
    s.dimmed && "is-dimmed",
  ]
    .filter(Boolean)
    .join(" ");
  const label = `${escapeHtml(b.shortName)}<span>${b.open > 0 ? `${b.open} open` : "none open"}</span>`;
  return `<div class="${cls}"><b>${b.open > 0 ? b.open : ""}</b><i class="opr-pin-label">${label}</i></div>`;
}

// Map colours per theme: near-black at night, a cool blue-white by day.
const PALETTE = {
  dark: {
    background: "#050505",
    water: "#0b1220",
    green: "#0b130e",
    land: "#0a0a0b",
    roadMajor: "#2a2a30",
    roadMinor: "#1b1b20",
    text: "#8b8b95",
    halo: "#050505",
    building: "#1c1c21",
  },
  light: {
    background: "#edf1f8",
    water: "#c3d4f0",
    green: "#dfe9e4",
    land: "#e6ecf6",
    roadMajor: "#ffffff",
    roadMinor: "#f8faff",
    text: "#53648a",
    halo: "#edf1f8",
    building: "#d9e1f0",
  },
};

// Recolours every layer of the base style to the app's palette and adds extruded
// 3D buildings.
function decorate(map: MapLibre, dark: boolean) {
  const c = dark ? PALETTE.dark : PALETTE.light;
  const paint = (id: string, prop: string, value: unknown) => {
    try {
      map.setPaintProperty(id, prop as never, value as never);
    } catch {}
  };
  for (const layer of map.getStyle().layers ?? []) {
    const id = layer.id;
    if (layer.type === "background") paint(id, "background-color", c.background);
    else if (layer.type === "fill") {
      if (/water/.test(id)) paint(id, "fill-color", c.water);
      else if (/park|wood|grass|landcover/.test(id)) paint(id, "fill-color", c.green);
      else if (/building/.test(id)) paint(id, "fill-color", c.building);
      else paint(id, "fill-color", c.land);
    } else if (layer.type === "line") {
      if (/waterway/.test(id)) paint(id, "line-color", c.water);
      else if (/highway|road|bridge|tunnel/.test(id)) {
        paint(id, "line-color", /major|motorway|trunk|primary|secondary/.test(id) ? c.roadMajor : c.roadMinor);
      }
    } else if (layer.type === "symbol") {
      paint(id, "text-color", c.text);
      paint(id, "text-halo-color", c.halo);
    }
  }
  if (!map.getLayer("building-3d") && map.getSource("openmaptiles")) {
    map.addLayer(
      {
        id: "building-3d",
        type: "fill-extrusion",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": c.building,
          "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, ["coalesce", ["get", "render_height"], 8]],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.9,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      map.getLayer("highway_name_other") ? "highway_name_other" : undefined,
    );
  }
}

export default function BuildingMap({
  buildings,
  selected,
  highlighted,
  focus,
  focusOffset = [0, 0],
  fitPadding = [24, 24, 24, 24],
  onBuildingClick,
  userLoc,
  onLocate,
  locating,
  controlsBottom = 12,
  controlsRight = 12,
  notice,
  onDismissNotice,
}: {
  buildings: MapBuilding[];
  selected: string[];
  highlighted: string | null;
  focus: { id: string; lat: number; lng: number } | null;
  // Pixels to shift the focused building by, so it isn't hidden under overlays.
  focusOffset?: [number, number];
  // Top, right, bottom, left padding when showing the whole campus.
  fitPadding?: [number, number, number, number];
  onBuildingClick: (id: string) => void;
  userLoc: LatLng | null;
  onLocate: () => void;
  locating: boolean;
  // Distance of the zoom controls from the bottom edge, to clear overlays.
  controlsBottom?: number;
  controlsRight?: number;
  // A short message about the locate button (blocked, far from campus, ...).
  notice: string | null;
  onDismissNotice: () => void;
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const darkRef = useRef(dark);
  const container = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibre | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  // Fallback when the browser refuses real full screen (iPhone Safari, embedded views):
  // the map simply covers the whole window.
  const [windowFull, setWindowFull] = useState(false);
  const isFull = fullscreen || windowFull;
  // Overlays outside the map (scrubber, room card) are hidden in full screen.
  const ctrlBottom = isFull ? 12 : controlsBottom;
  const ctrlRight = isFull ? 12 : controlsRight;
  const [tilted, setTilted] = useState(true);
  const [zoom, setZoom] = useState<{ now: number; base: number } | null>(null);
  const markers = useRef(new globalThis.Map<string, { marker: Marker; el: HTMLDivElement }>());
  const userMarker = useRef<Marker | null>(null);
  const clickRef = useRef(onBuildingClick);
  const [top, right, bottom, left] = fitPadding;
  const [offX, offY] = focusOffset;
  const padding = { top, right, bottom, left };

  useEffect(() => {
    clickRef.current = onBuildingClick;
    darkRef.current = dark;
  });

  // Create the map once.
  useEffect(() => {
    if (!container.current) return;
    const m = new MapLibre({
      container: container.current,
      style: darkRef.current ? STYLE.dark : STYLE.light,
      bounds: CAMPUS_BOUNDS,
      fitBoundsOptions: { padding, bearing: BEARING },
      pitch: TILT,
      bearing: BEARING,
      minZoom: 13,
      maxZoom: 19.5,
      maxPitch: 70,
      attributionControl: false,
    });
    m.addControl(new AttributionControl({ compact: true }), "top-right");
    // Keep the credits collapsed to their ⓘ button (MapLibre re-expands them as map data
    // arrives) until someone taps it open.
    let creditsOpened = false;
    const box = container.current;
    const collapseCredits = () => {
      if (!creditsOpened) box.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
    };
    box.addEventListener("click", (e) => {
      if ((e.target as Element).closest(".maplibregl-ctrl-attrib-button")) creditsOpened = true;
    });
    m.on("styledata", collapseCredits);
    m.on("load", collapseCredits);
    m.on("style.load", () => decorate(m, darkRef.current));
    m.on("zoom", () => setZoom((z) => ({ now: m.getZoom(), base: z?.base ?? m.getZoom() })));
    // Resizing clears the WebGL canvas, so always ask for a fresh frame afterwards; the
    // container keeps settling after creation (dynamic import, panels animating in).
    const fit = () => {
      m.resize();
      m.triggerRepaint();
    };
    m.once("load", () => {
      fit();
      setZoom({ now: m.getZoom(), base: m.getZoom() });
    });
    const ro = new ResizeObserver(fit);
    ro.observe(container.current);
    setMap(m);
    return () => {
      ro.disconnect();
      m.remove();
      setMap(null);
    };
    // The map is created once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Markers belong to one map instance. If the map is ever recreated (fast refresh,
  // strict-mode remounts), drop them so the effects below rebuild them on the new one.
  useEffect(() => {
    if (!map) return;
    const live = markers.current;
    return () => {
      for (const { marker } of live.values()) marker.remove();
      live.clear();
      userMarker.current?.remove();
      userMarker.current = null;
    };
  }, [map]);

  // Follow the light/dark setting.
  const shownDark = useRef(dark);
  useEffect(() => {
    if (!map || shownDark.current === dark) return;
    shownDark.current = dark;
    map.setStyle(dark ? STYLE.dark : STYLE.light);
  }, [map, dark]);

  // Keep one HTML marker per building in sync with the counts and selection.
  useEffect(() => {
    if (!map) return;
    const live = markers.current;
    const seen = new Set<string>();
    for (const b of buildings) {
      seen.add(b.id);
      const html = pinHtml(b, {
        selected: selected.includes(b.id),
        highlighted: highlighted === b.id,
        dimmed: selected.length > 0 && !selected.includes(b.id),
      });
      let entry = live.get(b.id);
      if (!entry) {
        const el = document.createElement("div");
        el.className = "opr-pin-anchor";
        el.setAttribute("role", "button");
        el.tabIndex = 0;
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          clickRef.current(b.id);
        });
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            clickRef.current(b.id);
          }
        });
        entry = { el, marker: new Marker({ element: el, anchor: "center" }).setLngLat([b.lng, b.lat]).addTo(map) };
        live.set(b.id, entry);
      }
      if (entry.el.innerHTML !== html) entry.el.innerHTML = html;
      entry.el.setAttribute("aria-label", `${b.shortName}: ${b.open} of ${b.total} rooms open`);
      entry.el.style.zIndex = highlighted === b.id ? "30" : selected.includes(b.id) ? "20" : b.open > 0 ? "10" : "1";
    }
    for (const [id, entry] of live) {
      if (!seen.has(id)) {
        entry.marker.remove();
        live.delete(id);
      }
    }
  }, [map, buildings, selected, highlighted]);

  useEffect(() => {
    if (!map) return;
    if (!userLoc) {
      userMarker.current?.remove();
      userMarker.current = null;
      return;
    }
    if (userMarker.current) userMarker.current.setLngLat([userLoc.lng, userLoc.lat]);
    else {
      const el = document.createElement("div");
      el.className = "opr-user";
      // A marker needs its position before it joins the map.
      userMarker.current = new Marker({ element: el }).setLngLat([userLoc.lng, userLoc.lat]).addTo(map);
    }
    // Far from campus, flying away from every study room isn't useful.
    if (distanceMeters(userLoc, CAMPUS_CENTER) <= NEAR_CAMPUS_M) {
      map.flyTo({ center: [userLoc.lng, userLoc.lat], zoom: Math.max(map.getZoom(), 16.5), duration: 900 });
    }
  }, [map, userLoc]);

  // Full screen applies to the map alone; Esc or the button leaves it.
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === wrapper.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  useEffect(() => {
    if (!windowFull) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setWindowFull(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [windowFull]);
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) return void (await document.exitFullscreen());
    if (windowFull) return setWindowFull(false);
    try {
      if (!document.fullscreenEnabled || !wrapper.current) throw new Error("unsupported");
      // Some embedded browsers neither grant nor refuse the request, so don't wait long.
      await Promise.race([wrapper.current.requestFullscreen(), new Promise((r) => setTimeout(r, 800))]);
      if (document.fullscreenElement !== wrapper.current) throw new Error("refused");
    } catch {
      setWindowFull(true);
    }
  };

  const showCampus = () => {
    if (!map) return;
    const cam = map.cameraForBounds(CAMPUS_BOUNDS, { padding, bearing: map.getBearing() });
    if (cam) map.flyTo({ ...cam, pitch: map.getPitch(), duration: 900 });
  };

  // Every input that should move the camera, as one value.
  const cameraKey = focus ? `${focus.id}:${offX}:${offY}` : `campus:${top}:${right}:${bottom}:${left}`;
  useEffect(() => {
    if (!map) return;
    if (!focus) {
      showCampus();
      return;
    }
    map.flyTo({
      center: [focus.lng, focus.lat],
      zoom: Math.max(map.getZoom(), FOCUS_ZOOM),
      offset: [-offX, -offY],
      duration: 1000,
      essential: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, cameraKey]);

  const toggleTilt = () => {
    if (!map) return;
    const next = !tilted;
    setTilted(next);
    map.easeTo({ pitch: next ? TILT : 0, bearing: next ? BEARING : 0, duration: 700 });
  };

  return (
    <div ref={wrapper} className={`opr-map bg-bg ${windowFull ? "fixed inset-0 z-[2500]" : "relative size-full"}`}>
      <div ref={container} className="size-full" />
      <div className="opr-map-vignette pointer-events-none absolute inset-0" aria-hidden="true" />
      <div
        className="opr-map-controls absolute z-10 transition-[right] duration-300"
        style={{ bottom: ctrlBottom, right: ctrlRight }}
      >
        <ControlBar
          zoomPercent={zoom ? 2 ** (zoom.now - zoom.base) * 100 : 100}
          onZoomIn={() => map?.zoomIn()}
          onZoomOut={() => map?.zoomOut()}
          onFit={showCampus}
          onLocate={onLocate}
          locating={locating}
          located={userLoc !== null}
          tilted={tilted}
          onTilt={toggleTilt}
          fullscreen={isFull}
          onFullscreen={() => void toggleFullscreen()}
        />
      </div>
      {notice && (
        <div
          role="status"
          className="glass rise absolute z-10 flex max-w-[min(340px,calc(100%-24px))] items-start gap-2 rounded-xl py-2.5 pl-3.5 pr-2 text-[12.5px] leading-snug"
          style={{ bottom: ctrlBottom + 48, right: 12 }}
        >
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            onClick={onDismissNotice}
            className="grid size-6 shrink-0 place-items-center rounded-md text-muted hover:bg-fg/10 hover:text-fg"
            aria-label="Dismiss"
          >
            <XIcon size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
