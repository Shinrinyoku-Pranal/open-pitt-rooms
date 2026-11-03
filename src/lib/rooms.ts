export const FEATURES = {
  whiteboard: "Whiteboard",
  chalkboard: "Chalkboard",
  tables: "Tables",
  windows: "Windows",
  accessible: "Accessible",
  ac: "A/C",
  "lecture-hall": "Lecture hall",
} as const;

export type FeatureSlug = keyof typeof FEATURES;
export type RoomKindName = "REGISTRAR" | "DEPARTMENTAL" | "NATIONALITY";

// Maps 25Live's raw feature strings (e.g. "Board - Dry Erase White Board 50-99 Sq Ft")
// to the handful of things students actually filter on.
export function normalizeFeatures(raw: string): FeatureSlug[] {
  const items = raw
    .split(",")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const out = new Set<FeatureSlug>();
  for (const f of items) {
    if (f.startsWith("Board - Dry Erase")) out.add("whiteboard");
    else if (f.startsWith("Board - Chalk")) out.add("chalkboard");
    else if (f === "Seating - Tables and Chairs" || f === "Seating - Active Learning") out.add("tables");
    else if (f === "Windows - Yes") out.add("windows");
    else if (f === "ADA Accessible - Student") out.add("accessible");
    else if (f === "Air Conditioning") out.add("ac");
    else if (f === "Floor - Tiered" || f === "Seating - Theater") out.add("lecture-hall");
  }
  return (Object.keys(FEATURES) as FeatureSlug[]).filter((k) => out.has(k));
}

export function classifyRoom(categories: string): RoomKindName {
  if (categories.includes("Nationality Room")) return "NATIONALITY";
  if (categories.includes("Registrar Room")) return "REGISTRAR";
  return "DEPARTMENTAL";
}

// "CL00G8" with prefix "CL" -> "G8"; "THAW0011" -> "11"; "LANGYA202" -> "A202".
export function roomNumberFromCode(code: string, prefix: string): string {
  return code.slice(prefix.length).replace(/^0+(?=.)/, "");
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\bOf\b/g, "of");
}

// Pulls a room's nickname out of its formal name, e.g.
// "CATHEDRAL OF LEARNING 126--Polish Nationality Room" -> "Polish Nationality Room"
// "CATHEDRAL OF LEARNING 317 - JAPANESE ROOM" -> "Japanese Room"
export function roomNickname(formalName: string): string | null {
  const m = formalName.match(/\d\w*\s*(?:--|\s-\s)\s*(.+)$/);
  if (!m) return null;
  const nick = m[1].trim();
  return nick === nick.toUpperCase() ? titleCase(nick) : nick;
}

export function displayNameFor(opts: {
  formalName: string;
  buildingShortName: string;
  roomNumber: string;
}): string {
  return roomNickname(opts.formalName) ?? `${opts.buildingShortName} ${opts.roomNumber}`;
}

// "HIST 1083 1010 22182 2271" -> "HIST 1083". Any other reservation becomes
// "Reserved": those titles are free text and often contain a person's name.
export function prettyEventTitle(title: string | null): string | null {
  if (!title) return null;
  const m = title.match(/^([A-Z]{2,8}) (\d{4})\b/);
  return m ? `${m[1]} ${m[2]}` : "Reserved";
}
