import { ROOM_TYPES, type FinderState } from "./finder";
import { FEATURES } from "./rooms";
import { formatDuration } from "./time";

export type FilterToken = { key: string; label: string; clear: Partial<FinderState> };

// The active filters as removable tokens, in the order a person would say them.
export function filterTokens(
  state: FinderState,
  ctx: { whenLabel: string | null; buildingName: (id: string) => string },
): FilterToken[] {
  const tokens: FilterToken[] = [];
  if (ctx.whenLabel) tokens.push({ key: "when", label: ctx.whenLabel, clear: { date: null, time: null } });
  if (state.minFree) tokens.push({ key: "free", label: `Free ${formatDuration(state.minFree)}+`, clear: { minFree: 0 } });
  if (state.minCap) tokens.push({ key: "cap", label: `${state.minCap}+ seats`, clear: { minCap: 0 } });
  for (const f of state.features) {
    tokens.push({ key: `f-${f}`, label: FEATURES[f], clear: { features: state.features.filter((x) => x !== f) } });
  }
  if (state.type !== "all") tokens.push({ key: "type", label: ROOM_TYPES[state.type], clear: { type: "all" } });
  for (const b of state.buildings) {
    tokens.push({ key: `b-${b}`, label: ctx.buildingName(b), clear: { buildings: state.buildings.filter((x) => x !== b) } });
  }
  if (state.favoritesOnly) tokens.push({ key: "fav", label: "Saved", clear: { favoritesOnly: false } });
  if (state.q) tokens.push({ key: "q", label: `“${state.q}”`, clear: { q: "" } });
  if (state.sort === "nearest") tokens.push({ key: "sort", label: "Nearest first", clear: { sort: "longest" } });
  return tokens;
}

function joinWords(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

// What the filters ask for, as a phrase: "with a whiteboard and tables, free 2 hr+, in Cathedral".
export function describeFilters(state: FinderState, buildingName: (id: string) => string): string {
  const bits: string[] = [];
  if (state.type !== "all") bits.push(state.type === "nationality" ? "Nationality Rooms" : ROOM_TYPES[state.type].toLowerCase());
  if (state.features.length) {
    bits.push(`with ${joinWords(state.features.map((f) => (f === "whiteboard" || f === "chalkboard" ? `a ${FEATURES[f].toLowerCase()}` : f === "ac" ? "A/C" : FEATURES[f].toLowerCase())))}`);
  }
  if (state.minCap) bits.push(`for ${state.minCap}+`);
  if (state.minFree) bits.push(`free ${formatDuration(state.minFree)}+`);
  if (state.buildings.length) bits.push(`in ${joinWords(state.buildings.map(buildingName))}`);
  if (state.favoritesOnly) bits.push("from your saved rooms");
  if (state.q) bits.push(`matching “${state.q}”`);
  return bits.join(", ");
}
