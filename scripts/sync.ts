// Manual sync: `npm run sync`. In production the same logic runs from
// /api/cron/sync on a schedule (see .github/workflows/sync.yml).
import { prisma } from "../src/lib/prisma";
import { runSync } from "../src/lib/sync";

async function main() {
  const started = Date.now();
  const result = await runSync();
  for (const w of result.warnings) console.warn("warning:", w);
  if (result.skipped) console.log("Skipped:", result.skipped);
  else if (result.ok) {
    console.log(
      `Sync OK in ${((Date.now() - started) / 1000).toFixed(1)}s: ${result.roomCount} rooms, ` +
        `${result.blockCount} blocks across ${result.dates[0]}..${result.dates.at(-1)}`,
    );
  } else {
    console.error("Sync failed:", result.error);
    process.exitCode = 1;
  }
  await prisma.$disconnect();
}

main();
