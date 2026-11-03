// Client for Pitt's public 25Live JSON endpoints (the same ones the guest web UI at
// https://25live.collegenet.com/pro/pitt uses). Read-only, no auth. Caching this data
// was approved by the registrar (rooms@registrar.pitt.edu).
//
// Everything is scoped to Pitt's own "STUDENT STUDY SPACES" public search, so the
// registrar controls which rooms appear here.

const BASE = "https://25live.collegenet.com/25live/data/pitt/run";
export const STUDY_SPACES_QUERY_ID = "1196429";

// 25Live's availability grid starts at 6:00 AM; nothing earlier is reported.
export const GRID_START_MIN = 6 * 60;

const USER_AGENT = "OpenPittRooms/1.0 (study room finder; caches public study-space availability)";

export class UpstreamError extends Error {}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function getJson(url: string, { attempts = 3, timeoutMs = 20_000 } = {}): Promise<unknown> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status >= 500 || res.status === 429) throw new UpstreamError(`25Live responded ${res.status}`);
      if (!res.ok) throw new UpstreamError(`25Live responded ${res.status} (not retrying)`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (err instanceof UpstreamError && err.message.includes("not retrying")) break;
      if (i < attempts - 1) await sleep(1000 * 2 ** i);
    }
  }
  throw lastErr instanceof Error ? lastErr : new UpstreamError(String(lastErr));
}

export type RawStudyRoom = {
  id: string;
  code: string;
  formalName: string;
  categories: string;
  features: string;
  capacity: number | null;
};

export function parseStudyRooms(json: unknown): RawStudyRoom[] {
  const data = json as { rows?: { pages?: number; row?: unknown[] }[] };
  if (!data || !Array.isArray(data.rows)) {
    throw new UpstreamError("Unexpected study-room list shape: missing rows");
  }
  if ((data.rows[0]?.pages ?? 1) > 1) {
    throw new UpstreamError("Study-room list is paginated; raise page_size");
  }
  return data.rows.map((r, i) => {
    const row = r.row;
    const head = row?.[0] as { itemId?: number; itemName?: string } | undefined;
    if (!row || !head?.itemId || !head.itemName || typeof row[1] !== "string") {
      throw new UpstreamError(`Unexpected study-room row shape at index ${i}`);
    }
    const capacity = typeof row[5] === "number" && row[5] > 0 ? row[5] : null;
    return {
      id: String(head.itemId),
      code: head.itemName.trim(),
      formalName: row[1].trim(),
      categories: typeof row[2] === "string" ? row[2] : "",
      features: typeof row[3] === "string" ? row[3] : "",
      capacity,
    };
  });
}

export async function fetchStudyRooms(): Promise<RawStudyRoom[]> {
  const url =
    `${BASE}/list/listdata.json?compsubject=location&sort=name&order=asc&page=1` +
    `&page_size=1000&obj_cache_accl=0&query_id=${STUDY_SPACES_QUERY_ID}&caller=pro-ListService.getData`;
  return parseStudyRooms(await getJson(url));
}

export type RawBlock = {
  roomId: string;
  startMin: number;
  endMin: number;
  kind: "EVENT" | "CLOSED";
  title: string | null;
};

const CLOSED_TYPE_ID = 3;

function toMinutes(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 60);
}

export function parseAvailability(json: unknown): { blocks: RawBlock[]; roomIds: Set<string> } {
  const data = json as {
    page_count?: number;
    subjects?: { itemId?: number; items?: Record<string, unknown>[] }[];
  };
  if (!data || !Array.isArray(data.subjects)) {
    throw new UpstreamError("Unexpected availability shape: missing subjects");
  }
  if ((data.page_count ?? 1) > 1) {
    throw new UpstreamError("Availability is paginated; raise page_size");
  }
  const blocks: RawBlock[] = [];
  const roomIds = new Set<string>();
  for (const subject of data.subjects) {
    if (!subject.itemId) continue;
    const roomId = String(subject.itemId);
    roomIds.add(roomId);
    for (const item of subject.items ?? []) {
      const startMin = Math.max(0, toMinutes(item.start));
      const endMin = Math.min(1440, toMinutes(item.end));
      if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) continue;
      const closed = Number(item.type_id) === CLOSED_TYPE_ID;
      blocks.push({
        roomId,
        startMin,
        endMin,
        kind: closed ? "CLOSED" : "EVENT",
        title: closed ? null : typeof item.itemName === "string" ? item.itemName.trim() : null,
      });
    }
  }
  return { blocks, roomIds };
}

export async function fetchDayAvailability(date: string) {
  const url =
    `${BASE}/availability/availabilitydata.json?obj_cache_accl=0&start_dt=${date}T00:00:00` +
    `&comptype=availability&compsubject=location&page_size=1000&query_id=${STUDY_SPACES_QUERY_ID}` +
    `&include=closed+blackouts+pending+related+empty&caller=pro-AvailService.getData`;
  return parseAvailability(await getJson(url));
}

export function pitt25LiveRoomUrl(roomId: string): string {
  return `https://25live.collegenet.com/pro/pitt#!/home/location/${roomId}/details`;
}
