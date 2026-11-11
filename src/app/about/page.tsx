import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BUILDINGS } from "@/lib/buildings";
import { REPO_URL, SITE_NAME } from "@/lib/site";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ClockIcon,
  CubeIcon,
  ExternalIcon,
  HourglassIcon,
  SearchIcon,
  ShareIcon,
  SlidersIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "About & privacy",
  description: "What Open Pitt Rooms is, how it works, where the data comes from, and how to contribute.",
};

const STATS = [
  { value: "170+", label: "study rooms" },
  { value: String(BUILDINGS.length), label: "buildings" },
  { value: "7 days", label: "of schedules" },
  { value: "Hourly", label: "refresh" },
];

const FEATURES = [
  {
    icon: <CubeIcon size={18} />,
    title: "See the whole campus at once",
    body: "A 3D map where every building shows how many rooms are open. The counts follow your filters.",
  },
  {
    icon: <SearchIcon size={18} />,
    title: "Ask in plain English",
    body: "Type “whiteboard for 2 hours near Cathedral tomorrow at 3pm” and it becomes filters you can see and remove. It runs on your device, with no AI service.",
  },
  {
    icon: <ClockIcon size={18} />,
    title: "Scrub through time",
    body: "Drag through the day or jump up to a week ahead. The map, the numbers and the list all follow.",
  },
  {
    icon: <HourglassIcon size={18} />,
    title: "Know how long it lasts",
    body: "“Free until 3:30 PM, then CHEM 0110”, plus every room’s full day and its week at a glance.",
  },
  {
    icon: <SlidersIcon size={18} />,
    title: "Filter for what you need",
    body: "Seats, whiteboards, tables, windows, accessibility, Nationality Rooms, or simply whatever is nearest.",
  },
  {
    icon: <ShareIcon size={18} />,
    title: "Take it with you",
    body: "Installs like an app, works in light and dark, and every view is a link you can send to your study group.",
  },
];

const STEPS = [
  {
    title: "The registrar decides the list",
    body: "We read Pitt’s own “Student Study Spaces” list from 25Live, the university’s scheduling system, so Pitt controls which rooms appear. Room hours come from 25Live too.",
  },
  {
    title: "We keep a cached copy",
    body: "About once an hour the schedule is refreshed into our own database, with permission from the Office of the University Registrar. Visitors never add load to 25Live.",
  },
  {
    title: "Your browser does the rest",
    body: "Room status, filters and the timeline are worked out on your device, so everything responds instantly.",
  },
];

const STACK = ["Next.js", "React", "TypeScript", "Tailwind CSS", "PostgreSQL", "Prisma", "MapLibre", "Vitest"];

const link = "font-medium text-primary underline underline-offset-4 hover:no-underline";

export default function About() {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-20 pt-8 sm:px-6 sm:pt-12">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-fg">
        <ArrowLeftIcon size={15} />
        Back to the map
      </Link>

      <header className="mt-8">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="" width={48} height={48} className="size-12 rounded-2xl ring-1 ring-line-strong" />
          <div className="leading-tight">
            <p className="font-semibold tracking-tight">{SITE_NAME}</p>
            <p className="text-sm text-muted">Free and open source</p>
          </div>
        </div>
        <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">Find an open study room at Pitt, right now.</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
          A live map of every official student study space at Pitt: which rooms are free, how long they stay free, and
          what&apos;s scheduled next.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 font-semibold text-accent-fg transition-opacity hover:opacity-90"
          >
            Open the map
            <ArrowRightIcon size={16} />
          </Link>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-panel px-4 py-2.5 font-semibold transition-colors hover:bg-surface"
          >
            View the code on GitHub
            <ExternalIcon size={15} />
          </a>
        </div>
        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col-reverse rounded-2xl border border-line bg-panel px-4 py-3">
              <dt className="text-sm text-muted">{s.label}</dt>
              <dd className="font-mono text-2xl font-semibold tracking-tight">{s.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold tracking-tight">Why it exists</h2>
        <p className="mt-3 leading-relaxed text-muted">
          Pitt&apos;s registrar keeps an official list of student study spaces, and their schedules live in 25Live, the
          university&apos;s scheduling system. 25Live is built for booking events, not for a student with forty minutes
          between classes. Open Pitt Rooms turns that same public schedule into something you can read at a glance.
        </p>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold tracking-tight">What you can do</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.title} className="rounded-2xl border border-line bg-panel p-5">
              <span className="grid size-9 place-items-center rounded-xl bg-accent-soft">{f.icon}</span>
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-muted">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-4 grid gap-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-fg font-mono text-sm font-semibold text-bg">
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold tracking-tight">Built in the open</h2>
        <p className="mt-3 leading-relaxed text-muted">
          Open Pitt Rooms is open source under the MIT license. Read the code, report a bug, tell us about a room
          we&apos;ve got wrong, or use it as a starting point for your own campus.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {STACK.map((t) => (
            <li key={t} className="rounded-full border border-line-strong bg-surface px-3 py-1 text-sm font-medium">
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          <a className={link} href={REPO_URL} target="_blank" rel="noreferrer">
            Browse the code
          </a>
          <a className={link} href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer">
            Report a bug or a wrong room
          </a>
        </p>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold tracking-tight">Good to know</h2>
        <div className="mt-4 divide-y divide-line rounded-2xl border border-line bg-panel">
          <div className="p-5">
            <h3 className="font-semibold">What &ldquo;open&rdquo; means</h3>
            <p className="mt-1 text-[15px] leading-relaxed text-muted">
              Open means nothing is scheduled in 25Live. A room can still be locked, in use by people who didn&apos;t
              book it, or booked after our last refresh. Every room links to its 25Live page so you can confirm, and if
              someone arrives with a reservation, the room is theirs. Departmental rooms may be locked or prioritized for
              that department.
            </p>
          </div>
          <div className="p-5">
            <h3 className="font-semibold">Your privacy</h3>
            <p className="mt-1 text-[15px] leading-relaxed text-muted">
              No accounts, no tracking cookies, no ads. &ldquo;Nearest&rdquo; sorting uses your location only on your
              device, and it is never sent to our server. Saved rooms stay in your browser. We count anonymous page
              views (Vercel Web Analytics, cookieless) to see how many people use the site.
            </p>
          </div>
          <div className="p-5">
            <h3 className="font-semibold">An independent project</h3>
            <p className="mt-1 text-[15px] leading-relaxed text-muted">
              Open Pitt Rooms is an independent student project and is not affiliated with or endorsed by the University
              of Pittsburgh. Questions about room policies or reservations go to{" "}
              <a className={link} href="mailto:rooms@registrar.pitt.edu">
                rooms@registrar.pitt.edu
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <footer className="mt-14 border-t border-line pt-6 text-sm leading-relaxed text-muted">
        <p>
          Built by{" "}
          <a className={link} href="https://github.com/Shinrinyoku-Pranal" target="_blank" rel="noreferrer">
            Pranal Siripurapu
          </a>
          . Maps by MapLibre and OpenFreeMap, with data from OpenStreetMap contributors.
        </p>
      </footer>
    </main>
  );
}
