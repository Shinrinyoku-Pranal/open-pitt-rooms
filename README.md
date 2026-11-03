# Open Pitt Rooms

Find an open study room at Pitt — right now, or at any time this week. Shows every
room on the registrar's official **Student Study Spaces** list (174 rooms, 21
buildings), how long each stays free, what's scheduled next, and the room's real
open hours.

- **3D campus map** as the whole background — glowing open-room counts per
  building that follow your filters; click a building to filter to it.
- **Time scrubber** — a chart of how many rooms are open across the day; drag it
  (or use the arrow keys) and the map, numbers and list follow. Any of the next 7
  days, with the busiest stretch marked.
- **At a glance** — rooms open (vs. an hour earlier), free 2+ hours, opening within
  30 minutes, share of rooms in class, and quick filters with live counts.
- **Ask in plain English** — "whiteboard for 2 hours near Cathedral tomorrow at
  3pm" becomes filters you can see and remove. Parsed locally by `src/lib/query.ts`
  (no AI service, nothing leaves the browser); words it doesn't understand are
  called out rather than silently dropped.
- **Open now / at a time / this week** — pick any day in the next 7 and any time.
- **Free until** — "Free until 3:30 PM · 2 hr 15 min · then CHEM 0110".
- **Honest counts** — a room only counts as open if it's free for at least 20
  minutes, so passing periods (10 min MWF, 15 min TuTh) don't inflate the number.
- **Filters** — time slider, free for, seats, whiteboard, chalkboard, tables,
  windows, accessible, A/C, lecture hall, room type (classroom / Nationality /
  departmental), buildings with live counts, sort, saved rooms.
- **Nearest-first** sorting (location stays on the device).
- **Day timeline** for each room, a link to its 25Live page to confirm, walking
  directions, and share links that restore every filter.
- **This week** for each room — the next 7 days at a glance with each day's
  longest free stretch; tap a day to jump the whole app there.
- **Add to calendar** — saves a room's free stretch as an `.ics` event (a reminder,
  clearly marked as not a reservation).
- Installable as a phone app (PWA), light/dark switch, keyboard and screen-reader
  friendly. Press `/` or `⌘K` to jump to the search box.

The map uses [MapLibre GL](https://maplibre.org) with free vector tiles from
[OpenFreeMap](https://openfreemap.org) (OpenStreetMap data; no API key or usage cap).

## How it works

```
GitHub Actions (every 30 min)          Vercel
        │                     ┌───────────────────────────────┐
        └─► /api/cron/sync ───┤ src/lib/sync.ts               │
                              │   1 request: study-room list   │──► 25Live public JSON
                              │   1 request per day: schedule  │    (query 1196429)
                              │   validate → one transaction  │
                              └──────────────┬────────────────┘
                                             ▼
                                        Postgres (Neon)
                                             ▲
  Browser ◄── CDN ◄── / (static, revalidated every 60s, today's data inlined)
          ◄── CDN ◄── /api/rooms?date=…  (cached 60s, other days)
```

- `src/lib/pitt25live.ts` — the 25Live client. Uses the registrar's "STUDENT
  STUDY SPACES" saved search, so Pitt controls which rooms appear. Strict parsing:
  an unexpected response shape throws instead of silently returning nothing.
- `src/lib/sync.ts` — refreshes today + tomorrow every run and the full week every
  6 hours (~2 and ~8 requests to 25Live respectively, spaced out). Refuses to apply
  a response that lost more than half the rooms, and never runs two syncs at once.
- `src/lib/roomState.ts` — pure availability logic (closed hours, back-to-back
  classes, free-until), shared by server and browser and unit-tested.
- The browser computes room status locally, so changing the time or filters is
  instant and costs the server nothing. Everyone gets the same cached responses,
  so thousands of users cost about the same as one.

## Local development

Requires Node 22+. On a Mac, keep the project outside iCloud-synced folders
(Desktop, Documents): iCloud offloads `node_modules` files and Prisma hangs on them.

```bash
npm install
npm run db:local          # starts a local Postgres (no Docker needed)
cp .env.example .env      # paste the TCP URL from `npx prisma dev ls` if the port differs
npx prisma migrate dev
npm run sync              # pulls real data from 25Live (~40s the first time)
npm run dev
```

Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Deploying (≈20 minutes, free tiers)

1. **Database** — create a free Postgres at [neon.tech](https://neon.tech) (or add
   Neon from the Vercel Marketplace). Copy two connection strings:
   - `DATABASE_URL`: the **pooled** string, plus `&pgbouncer=true&connection_limit=1`
   - `DIRECT_URL`: the **direct** (non-pooled) string, used for migrations
2. **Hosting** — push this repo to GitHub and import it at
   [vercel.com/new](https://vercel.com/new). Add environment variables:
   `DATABASE_URL`, `DIRECT_URL`, `CRON_SECRET` (`openssl rand -hex 32`), and
   `NEXT_PUBLIC_SITE_URL` (your final URL). Deploy — the build runs migrations.
3. **First data load** —
   `curl -H "Authorization: Bearer $CRON_SECRET" "$SITE_URL/api/cron/sync?full=1"`
4. **Scheduled sync** — in the GitHub repo: Settings → Secrets and variables →
   Actions. Add secret `CRON_SECRET` and variable `SITE_URL`. The
   `Sync 25Live data` workflow then runs every 30 minutes (6 AM–midnight ET);
   run it once by hand from the Actions tab to confirm. `vercel.json` also
   schedules a daily full refresh as a backup.
5. **Analytics** — Vercel dashboard → your project → Analytics → Enable. It's
   cookieless and counts unique visitors, so weekly active users are there from
   day one.
6. **Monitoring** — point a free uptime monitor (e.g. UptimeRobot) at
   `/api/health`. It returns 503 if the database is unreachable or data is more
   than 3 hours old, so you'll hear about a broken sync before students do.
7. **Domain** — add a custom domain in Vercel and update `NEXT_PUBLIC_SITE_URL`.

Note: GitHub pauses scheduled workflows in repos with no activity for 60 days —
push a commit or re-enable it from the Actions tab before each semester.

## Operations

| Symptom | Where to look |
| --- | --- |
| Stale-data banner on the site | Actions → Sync 25Live data logs; `/api/health` |
| Sync warning "No building configured for room …" | Pitt added a building to the study list — add it to `src/lib/buildings.ts` (code prefix + coordinates) |
| Sync error "Unexpected … shape" or "paginated" | 25Live changed its response format; existing data is kept until fixed |
| Wrong hours for a room | Hours come from 25Live's "Closed" blocks; anything before 6 AM is treated as closed |

Every sync is recorded in the `SyncRun` table with counts, warnings, and errors.

## Data use and caveats

Caching Pitt's public study-space availability was approved by the Office of the
University Registrar (rooms@registrar.pitt.edu). If you fork this for another
use, ask them first.

"Open" means 25Live shows nothing scheduled — not that a room is unlocked or
empty. Departmental rooms may be locked or prioritized for their department.
This is an independent student project, not affiliated with the University of
Pittsburgh.
