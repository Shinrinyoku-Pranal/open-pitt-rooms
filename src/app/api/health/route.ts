import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STALE_AFTER_MINUTES } from "@/lib/data";
import { lastSuccessfulSync } from "@/lib/sync";

export const dynamic = "force-dynamic";

// For uptime monitors: 200 when the DB is reachable and data is fresh, 503 otherwise.
export async function GET() {
  try {
    const [last, rooms] = await Promise.all([
      lastSuccessfulSync(),
      prisma.room.count({ where: { active: true } }),
    ]);
    const ageMinutes = last?.finishedAt ? Math.round((Date.now() - last.finishedAt.getTime()) / 60_000) : null;
    const fresh = ageMinutes !== null && ageMinutes <= STALE_AFTER_MINUTES;
    return NextResponse.json(
      { ok: fresh, lastSyncedAt: last?.finishedAt ?? null, ageMinutes, rooms },
      { status: fresh ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("Health check failed", err);
    return NextResponse.json({ ok: false, error: "database unreachable" }, { status: 503 });
  }
}
