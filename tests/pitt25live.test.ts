import { describe, expect, it } from "vitest";
import { parseAvailability, parseStudyRooms, UpstreamError } from "@/lib/pitt25live";
import { buildingForRoomCode } from "@/lib/buildings";
import studyRooms from "./fixtures/study-rooms.json";
import availability from "./fixtures/availability.json";

describe("parseStudyRooms (real 25Live response)", () => {
  const rooms = parseStudyRooms(studyRooms);

  it("parses every row", () => {
    expect(rooms).toHaveLength(8);
    expect(rooms.find((r) => r.code === "CL0126")).toMatchObject({
      formalName: "CATHEDRAL OF LEARNING 126--Polish Nationality Room",
      capacity: 11,
    });
  });

  it("maps every room to a configured building", () => {
    for (const r of rooms) expect(buildingForRoomCode(r.code), r.code).toBeDefined();
  });

  it("matches the longest building prefix", () => {
    expect(buildingForRoomCode("CLAPP00L9")?.id).toBe("CLAPP");
    expect(buildingForRoomCode("CL00G8")?.id).toBe("CL");
    expect(buildingForRoomCode("LANGYA202")?.id).toBe("LANGY");
    expect(buildingForRoomCode("NOPE123")).toBeUndefined();
  });

  it("rejects unexpected shapes instead of returning nothing", () => {
    expect(() => parseStudyRooms({})).toThrow(UpstreamError);
    expect(() => parseStudyRooms({ rows: [{ row: [] }] })).toThrow(UpstreamError);
    expect(() => parseStudyRooms({ rows: [{ pages: 2, row: [] }] })).toThrow(/paginated/);
  });
});

describe("parseAvailability (real 25Live response)", () => {
  const { blocks, roomIds } = parseAvailability(availability);

  it("returns blocks for every room", () => {
    expect(roomIds.size).toBe(8);
    expect(blocks.length).toBeGreaterThan(20);
  });

  it("separates closed hours from events", () => {
    const closedBlocks = blocks.filter((b) => b.kind === "CLOSED");
    expect(closedBlocks.length).toBeGreaterThan(0);
    for (const b of closedBlocks) expect(b.title).toBeNull();
    for (const b of blocks.filter((x) => x.kind === "EVENT")) expect(b.title).toBeTruthy();
  });

  it("produces sane minute ranges", () => {
    for (const b of blocks) {
      expect(b.startMin).toBeGreaterThanOrEqual(0);
      expect(b.endMin).toBeLessThanOrEqual(1440);
      expect(b.endMin).toBeGreaterThan(b.startMin);
    }
  });

  it("converts decimal hours to minutes", () => {
    const { blocks: one } = parseAvailability({
      subjects: [{ itemId: 1, items: [{ type_id: 1, start: "8.5", end: 10.833333, itemName: "X" }] }],
    });
    expect(one[0]).toMatchObject({ startMin: 510, endMin: 650 });
  });

  it("drops malformed items and rejects malformed responses", () => {
    const { blocks: none } = parseAvailability({
      subjects: [{ itemId: 1, items: [{ start: "abc", end: 9 }, { start: 10, end: 9 }] }],
    });
    expect(none).toEqual([]);
    expect(() => parseAvailability({ nope: true })).toThrow(UpstreamError);
    expect(() => parseAvailability({ page_count: 2, subjects: [] })).toThrow(/paginated/);
  });
});
