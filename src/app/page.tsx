import Finder from "@/components/Finder";
import { getDayData, type DayData } from "@/lib/data";
import { pittDateISO } from "@/lib/time";

// Statically rendered with today's data and refreshed at most once a minute, so the
// CDN serves nearly all traffic. Filters and times are applied in the browser.
export const revalidate = 60;

export default async function Home() {
  let initialData: DayData | null = null;
  try {
    initialData = await getDayData(pittDateISO());
  } catch (err) {
    // Render the shell anyway; the client retries via /api/rooms.
    console.error("Initial room data failed to load", err);
  }
  return <Finder initialData={initialData} />;
}
