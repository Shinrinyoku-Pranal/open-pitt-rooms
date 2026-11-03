import { NextRequest, NextResponse } from "next/server";
import { getDayData, selectableDates } from "@/lib/data";
import { isISODate, pittDateISO } from "@/lib/time";

export async function GET(req: NextRequest) {
  const today = pittDateISO();
  const date = req.nextUrl.searchParams.get("date") ?? today;

  if (!isISODate(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  if (!selectableDates(today).includes(date)) {
    return NextResponse.json({ error: "date is outside the available range" }, { status: 400 });
  }

  try {
    const data = await getDayData(date);
    return NextResponse.json(data, {
      headers: {
        // Everyone sees the same data, so let the CDN absorb traffic.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    console.error("GET /api/rooms failed", err);
    return NextResponse.json({ error: "Room data is temporarily unavailable" }, { status: 503 });
  }
}
