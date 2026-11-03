// Buildings that appear in Pitt's "STUDENT STUDY SPACES" 25Live search. Rooms are
// matched to a building by the longest code prefix (so "CLAPP00L9" -> CLAPP, not CL).
// A room whose prefix isn't listed here is skipped and reported as a sync warning,
// which is the signal to add a new building below.
//
// Coordinates come from OpenStreetMap (Nominatim) and point at the building entrance
// area; they're used for the map and for "nearest" sorting.
export type BuildingConfig = {
  id: string;
  name: string;
  shortName: string;
  lat: number;
  lng: number;
};

export const BUILDINGS: BuildingConfig[] = [
  { id: "ALLEN", name: "Allen Hall", shortName: "Allen", lat: 40.444592, lng: -79.958361 },
  { id: "ALUM", name: "Alumni Hall", shortName: "Alumni", lat: 40.445584, lng: -79.953894 },
  { id: "BENDM", name: "Benedum Hall", shortName: "Benedum", lat: 40.443792, lng: -79.95855 },
  { id: "CHVRN", name: "Chevron Science Center", shortName: "Chevron", lat: 40.445856, lng: -79.957616 },
  { id: "CL", name: "Cathedral of Learning", shortName: "Cathedral", lat: 40.444295, lng: -79.953191 },
  { id: "CLAPP", name: "Clapp Hall", shortName: "Clapp", lat: 40.44628, lng: -79.95314 },
  { id: "CRAWF", name: "Crawford Hall", shortName: "Crawford", lat: 40.446961, lng: -79.9542 },
  { id: "EBERL", name: "Eberly Hall", shortName: "Eberly", lat: 40.445835, lng: -79.958374 },
  { id: "FKART", name: "Frick Fine Arts Building", shortName: "Frick Fine Arts", lat: 40.441561, lng: -79.951094 },
  { id: "IS", name: "Information Sciences Building", shortName: "Info Sciences", lat: 40.447376, lng: -79.952693 },
  { id: "LANGY", name: "Langley Hall", shortName: "Langley", lat: 40.446742, lng: -79.95374 },
  { id: "LAWRN", name: "David Lawrence Hall", shortName: "Lawrence", lat: 40.442356, lng: -79.955163 },
  { id: "OEH", name: "Old Engineering Hall", shortName: "Old Engineering", lat: 40.44501, lng: -79.958068 },
  { id: "PUBHL", name: "Public Health (Crabtree/Parran)", shortName: "Public Health", lat: 40.443143, lng: -79.959171 },
  { id: "SCAIF", name: "Scaife Hall", shortName: "Scaife", lat: 40.443081, lng: -79.961219 },
  { id: "SENSQ", name: "Sennott Square", shortName: "Sennott", lat: 40.441515, lng: -79.956355 },
  { id: "SRCC", name: "Space Research Coordination Center", shortName: "SRCC", lat: 40.445443, lng: -79.957231 },
  { id: "THACK", name: "Thackeray Hall", shortName: "Thackeray", lat: 40.444311, lng: -79.957271 },
  { id: "THAW", name: "Thaw Hall", shortName: "Thaw", lat: 40.44516, lng: -79.957598 },
  { id: "VICTO", name: "Victoria Building", shortName: "Victoria", lat: 40.441313, lng: -79.960636 },
  { id: "WWPH", name: "Wesley W. Posvar Hall", shortName: "Posvar", lat: 40.441658, lng: -79.953799 },
];

const BY_PREFIX_LENGTH = [...BUILDINGS].sort((a, b) => b.id.length - a.id.length);

export function buildingForRoomCode(code: string): BuildingConfig | undefined {
  return BY_PREFIX_LENGTH.find((b) => code.startsWith(b.id));
}

// The middle of the study-space buildings, and how far from it still counts as "on
// campus" when deciding whether to follow someone's location on the map.
export const CAMPUS_CENTER = {
  lat: BUILDINGS.reduce((s, b) => s + b.lat, 0) / BUILDINGS.length,
  lng: BUILDINGS.reduce((s, b) => s + b.lng, 0) / BUILDINGS.length,
};
export const NEAR_CAMPUS_M = 4000;
