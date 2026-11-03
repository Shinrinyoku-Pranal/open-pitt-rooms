import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { ROOMS_CACHE_TAG } from "@/lib/data";
import { runSync, SYNC_DAYS } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Called on a schedule (Vercel Cron or the GitHub Actions workflow) with
// `Authorization: Bearer $CRON_SECRET`. `?full=1` forces a full-week refresh.
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const full = req.nextUrl.searchParams.get("full") === "1";
  const result = await runSync(full ? { days: SYNC_DAYS } : {});
  if (result.ok && !result.skipped) {
    revalidateTag(ROOMS_CACHE_TAG, { expire: 0 });
    revalidatePath("/");
  }
  if (!result.ok) console.error("Sync failed", result.error);
  for (const w of result.warnings) console.warn("Sync warning:", w);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
