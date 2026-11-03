import { describe, expect, it } from "vitest";
import { BUILDINGS } from "@/lib/buildings";
import { describeFilters, filterTokens } from "@/lib/answer";
import { DEFAULT_STATE } from "@/lib/finder";
import { parseQuery } from "@/lib/query";

// 2026-11-03 is a Tuesday.
const ctx = { today: "2026-11-03", buildings: BUILDINGS, knownTerm: (t: string) => ["324", "polish"].includes(t) };
const parse = (s: string) => parseQuery(s, ctx);

describe("parseQuery", () => {
  it("understands a full request", () => {
    expect(parse("Whiteboard for 2 hours near Cathedral tomorrow at 3pm")).toEqual({
      patch: { minFree: 120, date: "2026-11-04", time: "15:00", features: ["whiteboard"], buildings: ["CL"] },
      ignored: [],
    });
  });

  it("reads durations", () => {
    expect(parse("90 min").patch.minFree).toBe(90);
    expect(parse("an hour").patch.minFree).toBe(60);
    expect(parse("half an hour").patch.minFree).toBe(30);
    expect(parse("an hour and a half").patch.minFree).toBe(90);
    expect(parse("2.5 hrs").patch.minFree).toBe(150);
    expect(parse("free all day").patch.minFree).toBe(180);
    expect(parse("Free for 2+ hours").patch).toEqual({ minFree: 120 });
    expect(parse("45+ min").patch.minFree).toBe(45);
  });

  it("reads times and days", () => {
    expect(parse("at 3").patch.time).toBe("15:00");
    expect(parse("at 9").patch.time).toBe("09:00");
    expect(parse("4:30").patch.time).toBe("16:30");
    expect(parse("10:15 a.m.").patch.time).toBe("10:15");
    expect(parse("12pm").patch.time).toBe("12:00");
    expect(parse("tonight").patch.time).toBe("19:00");
    expect(parse("thursday afternoon").patch).toEqual({ date: "2026-11-05", time: "13:00" });
    expect(parse("tuesday").patch.date).toBeNull(); // today
    expect(parse("now").patch.time).toBeNull();
  });

  it("reads group sizes without confusing them with times", () => {
    expect(parse("room for 6").patch).toEqual({ minCap: 6 });
    expect(parse("group of 4 at 2pm").patch).toEqual({ minCap: 4, time: "14:00" });
    expect(parse("12 people").patch.minCap).toBe(12);
    expect(parse("for 2 hours").patch).toEqual({ minFree: 120 });
  });

  it("reads features, room types, buildings and sorting", () => {
    expect(parse("tables windows a/c").patch.features).toEqual(["tables", "windows", "ac"]);
    expect(parse("nationality rooms").patch.type).toBe("nationality");
    expect(parse("posvar or sennott").patch.buildings?.sort()).toEqual(["SENSQ", "WWPH"]);
    expect(parse("cathy").patch.buildings).toEqual(["CL"]);
    expect(parse("clapp").patch.buildings).toEqual(["CLAPP"]);
    expect(parse("closest saved room").patch).toEqual({ favoritesOnly: true, sort: "nearest" });
  });

  it("understands every suggestion chip", () => {
    expect(parse("Whiteboard near Cathedral").patch).toEqual({ features: ["whiteboard"], buildings: ["CL"] });
    expect(parse("Group of 6 tomorrow at 3pm").patch).toEqual({ minCap: 6, date: "2026-11-04", time: "15:00" });
    expect(parse("Nationality Rooms")).toEqual({ patch: { type: "nationality" }, ignored: [] });
    expect(parse("Closest to me")).toEqual({ patch: { sort: "nearest" }, ignored: [] });
  });

  it("keeps words that match a room as a search and reports the rest", () => {
    expect(parse("Polish room")).toEqual({ patch: { q: "polish" }, ignored: [] });
    expect(parse("Cathedral 324 with a vibe")).toEqual({ patch: { buildings: ["CL"], q: "324" }, ignored: ["vibe"] });
  });
});

describe("answer text", () => {
  const name = (id: string) => BUILDINGS.find((b) => b.id === id)?.shortName ?? id;
  const state = { ...DEFAULT_STATE, features: ["whiteboard" as const, "tables" as const], minFree: 120, buildings: ["CL"] };

  it("describes filters in words", () => {
    expect(describeFilters(state, name)).toBe("with a whiteboard and tables, free 2 hr+, in Cathedral");
    expect(describeFilters(DEFAULT_STATE, name)).toBe("");
  });

  it("lists removable tokens", () => {
    const tokens = filterTokens(state, { whenLabel: "Tomorrow · 3 PM", buildingName: name });
    expect(tokens.map((t) => t.label)).toEqual(["Tomorrow · 3 PM", "Free 2 hr+", "Whiteboard", "Tables", "Cathedral"]);
    expect(tokens[2].clear).toEqual({ features: ["tables"] });
  });
});
