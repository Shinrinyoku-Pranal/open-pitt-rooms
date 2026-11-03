import { prisma } from "./prisma";
import { BUILDINGS, buildingForRoomCode } from "./buildings";
import { fetchDayAvailability, fetchStudyRooms, type RawBlock } from "./pitt25live";
import { classifyRoom, displayNameFor, normalizeFeatures, roomNumberFromCode } from "./rooms";
import { addDays, pittDateISO } from "./time";

export const SYNC_DAYS = 7;
const QUICK_SYNC_DAYS = 2;
const FULL_SYNC_EVERY_MS = 6 * 60 * 60_000;
const DELAY_BETWEEN_REQUESTS_MS = 750;
// Refuse to apply a catalog that lost more than half its rooms at once — far more
// likely an upstream glitch than Pitt actually removing half the study spaces.
const MAX_ROOM_DROP_RATIO = 0.5;

export type SyncResult = {
  ok: boolean;
  skipped?: string;
  roomCount: number;
  blockCount: number;
  dates: string[];
  warnings: string[];
  error?: string;
};

// Frequent runs refresh today + tomorrow (what most people look at); a full week is
// re-pulled every few hours. Keeps each run short and our load on 25Live small.
export async function chooseSyncDays(): Promise<number> {
  const recentRuns = await prisma.syncRun.findMany({
    where: { ok: true, finishedAt: { gt: new Date(Date.now() - FULL_SYNC_EVERY_MS) } },
    select: { dates: true },
  });
  return recentRuns.some((r) => r.dates.length >= SYNC_DAYS) ? QUICK_SYNC_DAYS : SYNC_DAYS;
}

export async function runSync({ days }: { days?: number } = {}): Promise<SyncResult> {
  days ??= await chooseSyncDays();
  const inFlight = await prisma.syncRun.findFirst({
    where: { finishedAt: null, startedAt: { gt: new Date(Date.now() - 5 * 60_000) } },
  });
  if (inFlight) {
    return { ok: true, skipped: "Another sync is already running", roomCount: 0, blockCount: 0, dates: [], warnings: [] };
  }

  const today = pittDateISO();
  const dates = Array.from({ length: days }, (_, i) => addDays(today, i));
  const run = await prisma.syncRun.create({ data: { dates } });
  const warnings: string[] = [];

  try {
    const rawRooms = await fetchStudyRooms();
    if (rawRooms.length === 0) throw new Error("25Live returned zero study rooms; keeping existing data");

    const activeCount = await prisma.room.count({ where: { active: true } });
    if (activeCount > 0 && rawRooms.length < activeCount * (1 - MAX_ROOM_DROP_RATIO)) {
      throw new Error(
        `25Live returned ${rawRooms.length} rooms vs ${activeCount} active; refusing a drop that large`,
      );
    }

    const rooms = rawRooms.flatMap((r) => {
      const building = buildingForRoomCode(r.code);
      if (!building) {
        warnings.push(`No building configured for room ${r.code} (${r.formalName})`);
        return [];
      }
      const roomNumber = roomNumberFromCode(r.code, building.id);
      return [
        {
          id: r.id,
          code: r.code,
          formalName: r.formalName,
          roomNumber,
          displayName: displayNameFor({ formalName: r.formalName, buildingShortName: building.shortName, roomNumber }),
          capacity: r.capacity,
          kind: classifyRoom(r.categories),
          features: normalizeFeatures(r.features),
          buildingId: building.id,
        },
      ];
    });
    const roomIds = new Set(rooms.map((r) => r.id));

    const blocksByDate = new Map<string, RawBlock[]>();
    for (const [i, date] of dates.entries()) {
      if (i > 0) await new Promise((r) => setTimeout(r, DELAY_BETWEEN_REQUESTS_MS));
      const { blocks } = await fetchDayAvailability(date);
      blocksByDate.set(
        date,
        blocks.filter((b) => roomIds.has(b.roomId)),
      );
    }

    let blockCount = 0;
    await prisma.$transaction(
      async (tx) => {
        for (const b of BUILDINGS) {
          await tx.building.upsert({
            where: { id: b.id },
            create: b,
            update: { name: b.name, shortName: b.shortName, lat: b.lat, lng: b.lng },
          });
        }
        for (const room of rooms) {
          await tx.room.upsert({
            where: { id: room.id },
            create: { ...room, active: true },
            update: { ...room, active: true },
          });
        }
        await tx.room.updateMany({ where: { id: { notIn: [...roomIds] } }, data: { active: false } });

        await tx.block.deleteMany({ where: { OR: [{ date: { in: dates } }, { date: { lt: addDays(today, -1) } }] } });
        for (const [date, blocks] of blocksByDate) {
          if (blocks.length === 0) continue;
          await tx.block.createMany({
            data: blocks.map((b) => ({ ...b, date })),
          });
          blockCount += blocks.length;
        }
      },
      { timeout: 60_000, maxWait: 10_000 },
    );

    await prisma.syncRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: true, roomCount: rooms.length, blockCount, warnings },
    });
    return { ok: true, roomCount: rooms.length, blockCount, dates, warnings };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.syncRun
      .update({ where: { id: run.id }, data: { finishedAt: new Date(), ok: false, error: message, warnings } })
      .catch(() => {});
    return { ok: false, roomCount: 0, blockCount: 0, dates, warnings, error: message };
  }
}

export async function lastSuccessfulSync() {
  return prisma.syncRun.findFirst({
    where: { ok: true },
    orderBy: { finishedAt: "desc" },
    select: { finishedAt: true, roomCount: true, blockCount: true, dates: true },
  });
}
