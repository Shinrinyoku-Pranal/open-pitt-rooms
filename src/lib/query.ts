import { MAX_MIN_CAP, MAX_MIN_FREE, type FinderState, type RoomType } from "./finder";
import type { FeatureSlug } from "./rooms";
import { addDays, toHHMM } from "./time";

// Turns a typed request like "whiteboard for 2 hours near Cathedral tomorrow at 3pm"
// into filters. Everything runs locally and deterministically: each rule removes the
// words it understood, and whatever is left becomes a text search if it matches a
// room, or is reported back as not understood.

export type QueryBuilding = { id: string; name: string; shortName: string };

export type ParsedQuery = {
  patch: Partial<FinderState>;
  ignored: string[];
};

const FEATURE_WORDS: [RegExp, FeatureSlug][] = [
  [/\b(white ?boards?|dry[- ]?erase|marker ?boards?)\b/, "whiteboard"],
  [/\b(chalk ?boards?|chalk)\b/, "chalkboard"],
  [/\b(tables?|desks?)\b/, "tables"],
  [/\b(windows?|natural light|sunlight|sunny|daylight)\b/, "windows"],
  [/\b(accessible|wheelchair|ada)\b/, "accessible"],
  [/\b(a\/c|ac|air[- ]?condition(?:ing|ed)?)\b/, "ac"],
  [/\b(lecture halls?|auditoriums?|tiered|theat(?:er|re) seating)\b/, "lecture-hall"],
];

const TYPE_WORDS: [RegExp, RoomType][] = [
  [/\bnationality( rooms?)?\b/, "nationality"],
  [/\bdepartment(al)?( rooms?)?\b/, "departmental"],
  [/\bclassrooms?\b/, "classroom"],
];

// Nicknames students actually use, on top of each building's name and short name.
const BUILDING_ALIASES: Record<string, string[]> = {
  CL: ["cathy", "cathedral", "the cathedral", "cl"],
  WWPH: ["posvar", "wwph", "wesley posvar"],
  SENSQ: ["sennott", "sennot", "sennott square"],
  IS: ["info sci", "info sciences", "information sciences", "isb"],
  PUBHL: ["public health", "gsph", "crabtree", "parran"],
  FKART: ["frick", "frick fine arts", "fine arts"],
  LAWRN: ["lawrence", "david lawrence", "dl hall"],
  OEH: ["old engineering", "old eng"],
  THACK: ["thackeray", "thackery"],
  BENDM: ["benedum", "benedum hall"],
  SRCC: ["srcc", "space research"],
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WEEKDAY_RE = /\b(sun|mon|tues?|wed|thu|thurs|fri|sat)(day|nesday|rsday|urday)?\b/;

const STOPWORDS = new Set(
  (
    "a an the i me my we us our need needs want wanna looking look find show get give any some somewhere " +
    "room rooms space spaces spot spots place places study studying work working to for with in at on near " +
    "nearby by around of and or that has have is are there right please can could would like quiet empty open " +
    "free available good nice where which what one something hall building pitt campus just only also anywhere " +
    "this that today now people person seats seat group me friends hours hour mins minutes long until from " +
    "morning afternoon evening tonight"
  ).split(" "),
);

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseQuery(
  input: string,
  ctx: {
    today: string;
    buildings: QueryBuilding[];
    // True if a leftover word appears in some room's name or code.
    knownTerm: (term: string) => boolean;
  },
): ParsedQuery {
  let text = ` ${input
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\b([ap])\.m\.?/g, "$1m")
    .replace(/[,;!?]/g, " ")} `;
  const patch: Partial<FinderState> = {};
  // Removes the first match of `re` if `fn` accepts it (doesn't return false).
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean | void) => {
    const m = text.match(re);
    if (!m || fn(m) === false) return false;
    text = text.replace(m[0], " ");
    return true;
  };
  // Applies the first rule that matches and is accepted.
  const first = (rules: [RegExp, (m: RegExpMatchArray) => boolean | void][]) => rules.some(([re, fn]) => take(re, fn));

  // --- How long it needs to stay free ---------------------------------------
  const setFree = (mins: number) => {
    if (!Number.isFinite(mins) || mins <= 0) return false;
    patch.minFree = Math.min(Math.max(Math.round(mins), 15), MAX_MIN_FREE);
  };
  first([
    [/\b(an|one) hour and a half\b/, () => setFree(90)],
    [/\b(\d+(?:\.\d+)?)\+?\s*(?:-|\s)?(hours?|hrs?|h)\b/, (m) => setFree(Number(m[1]) * 60)],
    [/\b(\d+)\+?\s*(?:-|\s)?(minutes?|mins?|m)\b/, (m) => setFree(Number(m[1]))],
    [/\b(half an hour|half hour)\b/, () => setFree(30)],
    [/\b(an|one|a) hour\b/, () => setFree(60)],
    [/\b(all day|rest of the day|long time|a while|all afternoon|all night)\b/, () => setFree(180)],
  ]);

  // --- Day --------------------------------------------------------------------
  first([
    [/\b(tomorrow|tmrw|tmr|tmw)\b/, () => void (patch.date = addDays(ctx.today, 1))],
    [
      WEEKDAY_RE,
      (m) => {
        const target = WEEKDAYS.findIndex((d) => d.startsWith(m[1].slice(0, 3)));
        const todayIdx = new Date(`${ctx.today}T12:00:00Z`).getUTCDay();
        const ahead = (target - todayIdx + 7) % 7;
        patch.date = ahead === 0 ? null : addDays(ctx.today, ahead);
      },
    ],
    [/\btoday\b/, () => void (patch.date = null)],
  ]);

  // --- Time of day ------------------------------------------------------------
  const setTime = (h: number, min: number) => {
    if (h < 0 || h > 23 || min < 0 || min > 59) return false;
    patch.time = toHHMM(h * 60 + min);
  };
  first([
    [
      /(?:\b(?:at|around|by|after|from)\s*|@\s*)?\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/,
      (m) => {
        const h = Number(m[1]);
        if (h < 1 || h > 12) return false;
        return setTime((h % 12) + (m[3] === "pm" ? 12 : 0), Number(m[2] ?? 0));
      },
    ],
    [
      /(?:\b(?:at|around|by|after|from)\s+|@\s*)(\d{1,2})(?::(\d{2}))?\b(?!\s*(?:people|persons|ppl|seats|students))|\b(\d{1,2}):(\d{2})\b/,
      (m) => {
        const h = Number(m[1] ?? m[3]);
        // A bare "3" or "3:30" means the afternoon; "9" means the morning, matching class hours.
        return setTime(h === 12 ? 12 : h >= 1 && h < 8 ? h + 12 : h, Number(m[2] ?? m[4] ?? 0));
      },
    ],
    [/\b(noon|midday)\b/, () => setTime(12, 0)],
    [/\b(right now|now)\b/, () => void (patch.time = null)],
    [/\b(this )?morning\b/, () => setTime(9, 0)],
    [/\b(this )?afternoon\b/, () => setTime(13, 0)],
    [/\b(this )?evening\b/, () => setTime(18, 0)],
    [/\btonight\b/, () => setTime(19, 0)],
  ]);

  // --- Group size ---------------------------------------------------------------
  const setCap = (n: number) => {
    if (!Number.isFinite(n) || n < 1) return false;
    patch.minCap = Math.min(n, MAX_MIN_CAP);
  };
  first([
    [/\b(\d+)\+?\s*(people|persons|ppl|students|seats|of us|friends|others|person)\b/, (m) => setCap(Number(m[1]))],
    [/\b(group|party|team) of (\d+)\b/, (m) => setCap(Number(m[2]))],
    [/\bseats? (?:for )?(\d+)\b/, (m) => setCap(Number(m[1]))],
    [/\bfor (\d+)\b/, (m) => setCap(Number(m[1]))],
    [/\b(big|large|huge) (group|room)\b/, () => setCap(50)],
    [/\b(group|study group)\b/, () => setCap(6)],
  ]);

  // --- Features, room type, buildings ------------------------------------------
  const features = new Set<FeatureSlug>();
  for (const [re, slug] of FEATURE_WORDS) take(re, () => void features.add(slug));
  if (features.size) patch.features = [...features];

  first(TYPE_WORDS.map(([re, type]) => [re, () => void (patch.type = type)]));

  const buildingHits = new Set<string>();
  const names = ctx.buildings
    .flatMap((b) =>
      [b.name, b.shortName, ...(BUILDING_ALIASES[b.id] ?? [])].map((n) => ({ id: b.id, n: n.toLowerCase() })),
    )
    .sort((a, b) => b.n.length - a.n.length);
  for (const { id, n } of names) {
    if (n.length >= 2) take(new RegExp(`\\b${escapeRe(n)}\\b`), () => void buildingHits.add(id));
  }
  if (buildingHits.size) patch.buildings = [...buildingHits];

  // --- Saved rooms and sorting ---------------------------------------------------
  take(/\b(my saved|saved|favorites?|favourites?|starred|my rooms)\b/, () => {
    patch.favoritesOnly = true;
  });
  take(/\b(nearest|closest|near me|close to me|nearby|close by)\b/, () => {
    patch.sort = "nearest";
  });

  // --- Leftovers ----------------------------------------------------------------
  const ignored: string[] = [];
  const search: string[] = [];
  for (const word of text.split(/\s+/)) {
    const w = word.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
    if (!w || STOPWORDS.has(w)) continue;
    if (ctx.knownTerm(w)) search.push(w);
    else ignored.push(w);
  }
  if (search.length) patch.q = search.join(" ").slice(0, 60);

  return { patch, ignored };
}
