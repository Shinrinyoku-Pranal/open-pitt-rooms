import { NextRequest, NextResponse } from "next/server";
import { getRoomWeek } from "@/lib/data";

// One room's schedule for the next seven days: ?room=<25Live space id>.
export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get("room") ?? "";
  if (!/^\d{1,10}$/.test(room)) {
    return NextResponse.json({ error: "room must be a 25Live space id" }, { status: 400 });
  }

  try {
    const week = await getRoomWeek(room);
    if (!week) return NextResponse.json({ error: "Unknown room" }, { status: 404 });
    return NextResponse.json(week, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" },
    });
  } catch (err) {
    console.error("GET /api/room-week failed", err);
    return NextResponse.json({ error: "Room data is temporarily unavailable" }, { status: 503 });
  }
}
