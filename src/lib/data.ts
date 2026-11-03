import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { BUILDINGS } from "./buildings";
import { pitt25LiveRoomUrl } from "./pitt25live";
import { prettyEventTitle, type FeatureSlug, type RoomKindName } from "./rooms";
import type { ScheduleBlock } from "./roomState";
import { addDays, pittDateISO } from "./time";
import { SYNC_DAYS, lastSuccessfulSync } from "./sync";

// Data older than this gets a visible warning in the UI and fails the health check.
export const STALE_AFTER_MINUTES = 180;

export type BuildingDTO = { id: string; name: string; shortName: string; lat: number; lng: number };

export type RoomDTO = {
  id: string;
  code: string;
  displayName: string;
  roomNumber: string;
  formalName: string;
  capacity: number | null;
  kind: RoomKindName;
  features: FeatureSlug[];
  buildingId: string;
  url25Live: string;
  blocks: ScheduleBlock[];
};

export type DayData = {
  generatedAt: number;
  date: string;
  today: string;
  dates: string[];
  lastSyncedAt: string | null;
  stale: boolean;
  hasData: boolean;
  buildings: BuildingDTO[];
  rooms: RoomDTO[];
};

export function selectableDates(today: string): string[] {
  return Array.from({ length: SYNC_DAYS }, (_, i) => addDays(today, i));
}

async function loadDayData(date: string): Promise<DayData> {
  const today = pittDateISO();
  const [rooms, lastSync, blockDayCount] = await Promise.all([
    prisma.room.findMany({
      where: { active: true },
      orderBy: [{ buildingId: "asc" }, { code: "asc" }],
      include: {
        blocks: {
          where: { date },
          orderBy: { startMin: "asc" },
          select: { startMin: true, endMin: true, kind: true, title: true },
        },
      },
    }),
    lastSuccessfulSync(),
    prisma.block.count({ where: { date } }),
  ]);

  const lastSyncedAt = lastSync?.finishedAt ?? null;
  const stale = !lastSyncedAt || Date.now() - lastSyncedAt.getTime() > STALE_AFTER_MINUTES * 60_000;

  return {
    generatedAt: Date.now(),
    date,
    today,
    dates: selectableDates(today),
    lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
    stale,
    hasData: rooms.length > 0 && blockDayCount > 0,
    buildings: BUILDINGS.map(({ id, name, shortName, lat, lng }) => ({ id, name, shortName, lat, lng })),
    rooms: rooms.map((r) => ({
      id: r.id,
      code: r.code,
      displayName: r.displayName,
      roomNumber: r.roomNumber,
      formalName: r.formalName,
      capacity: r.capacity,
      kind: r.kind,
      features: r.features as FeatureSlug[],
      buildingId: r.buildingId,
      url25Live: pitt25LiveRoomUrl(r.id),
      blocks: r.blocks.map((b) => ({ ...b, title: prettyEventTitle(b.title) })),
    })),
  };
}

export const ROOMS_CACHE_TAG = "rooms";

// Shared across requests on the server for up to a minute; a successful sync expires
// it immediately (see /api/cron/sync), so new schedules show up right away.
export const getDayData = unstable_cache(loadDayData, ["day-data-v1"], {
  revalidate: 60,
  tags: [ROOMS_CACHE_TAG],
});

export type RoomWeekDTO = {
  roomId: string;
  days: { date: string; loaded: boolean; blocks: ScheduleBlock[] }[];
};

async function loadRoomWeek(roomId: string): Promise<RoomWeekDTO | null> {
  const dates = selectableDates(pittDateISO());
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      blocks: {
        where: { date: { in: dates } },
        orderBy: { startMin: "asc" },
        select: { date: true, startMin: true, endMin: true, kind: true, title: true },
      },
    },
  });
  if (!room) return null;
  return {
    roomId: room.id,
    days: dates.map((date) => {
      const blocks = room.blocks.filter((b) => b.date === date);
      // Synced days always contain the room's closed hours, so no blocks means not synced.
      return {
        date,
        loaded: blocks.length > 0,
        blocks: blocks.map(({ startMin, endMin, kind, title }) => ({ startMin, endMin, kind, title: prettyEventTitle(title) })),
      };
    }),
  };
}

// One room's next seven days, for the "This week" view.
export const getRoomWeek = unstable_cache(loadRoomWeek, ["room-week-v1"], {
  revalidate: 60,
  tags: [ROOMS_CACHE_TAG],
});
