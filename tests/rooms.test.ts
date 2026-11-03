import { describe, expect, it } from "vitest";
import { classifyRoom, displayNameFor, normalizeFeatures, prettyEventTitle, roomNickname, roomNumberFromCode } from "@/lib/rooms";

describe("room naming", () => {
  it("extracts room numbers from codes", () => {
    expect(roomNumberFromCode("CL00G8", "CL")).toBe("G8");
    expect(roomNumberFromCode("CL0G24", "CL")).toBe("G24");
    expect(roomNumberFromCode("THAW0011", "THAW")).toBe("11");
    expect(roomNumberFromCode("LANGYA202", "LANGY")).toBe("A202");
    expect(roomNumberFromCode("CLAPP00L9", "CLAPP")).toBe("L9");
    expect(roomNumberFromCode("PUBHL2121C", "PUBHL")).toBe("2121C");
  });

  it("pulls nicknames out of formal names", () => {
    expect(roomNickname("CATHEDRAL OF LEARNING 126--Polish Nationality Room")).toBe("Polish Nationality Room");
    expect(roomNickname("CATHEDRAL OF LEARNING 317 - JAPANESE ROOM")).toBe("Japanese Room");
    expect(roomNickname("BENEDUM HALL 1045 - HOLZMAN EXECUTIVE CLASSROOM")).toBe("Holzman Executive Classroom");
    expect(roomNickname("BENEDUM HALL 157 (ENGUDAUD)")).toBeNull();
    expect(roomNickname("WESLEY W. POSVAR HALL 1500")).toBeNull();
  });

  it("builds display names", () => {
    expect(displayNameFor({ formalName: "WESLEY W. POSVAR HALL 1500", buildingShortName: "Posvar", roomNumber: "1500" })).toBe(
      "Posvar 1500",
    );
    expect(
      displayNameFor({
        formalName: "CATHEDRAL OF LEARNING 330--African Heritage Room",
        buildingShortName: "Cathedral",
        roomNumber: "330",
      }),
    ).toBe("African Heritage Room");
  });

  it("shortens course section titles", () => {
    expect(prettyEventTitle("HIST 1083 1010 22182 2271")).toBe("HIST 1083");
    expect(prettyEventTitle("RELGST 1560 1025 CS 22057 2271")).toBe("RELGST 1560");
    expect(prettyEventTitle("Jane Doe Dissertation Defense")).toBe("Reserved");
    expect(prettyEventTitle("ELI OFFICE HOURS")).toBe("Reserved");
    expect(prettyEventTitle(null)).toBeNull();
  });
});

describe("room classification", () => {
  it("classifies by category", () => {
    expect(classifyRoom("Nationality Room, Registrar Room")).toBe("NATIONALITY");
    expect(classifyRoom("Registrar Room")).toBe("REGISTRAR");
    expect(classifyRoom("Departmental Priority Room (Privilege)")).toBe("DEPARTMENTAL");
    expect(classifyRoom("")).toBe("DEPARTMENTAL");
  });

  it("normalizes 25Live features", () => {
    const raw =
      "ADA Accessible  - Student, Air Conditioning, Board - Dry Erase White Board 50-99 Sq Ft, " +
      "Seating - Tables and Chairs, Windows - Yes, Floor - Tiered, Media - CD";
    expect(normalizeFeatures(raw)).toEqual(["whiteboard", "tables", "windows", "accessible", "ac", "lecture-hall"]);
    expect(normalizeFeatures("Windows - No, Seating - Tablet Arm Desks, Board - Chalk less than 50 Sq Ft")).toEqual([
      "chalkboard",
    ]);
    expect(normalizeFeatures("")).toEqual([]);
  });
});
