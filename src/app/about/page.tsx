import type { Metadata } from "next";
import Link from "next/link";
import { BUILDINGS } from "@/lib/buildings";

export const metadata: Metadata = {
  title: "About & privacy",
  description: "How Open Pitt Rooms works, where the data comes from, and what it does and doesn't track.",
};

export default function About() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="text-sm font-medium text-accent hover:underline">
        ← Back to rooms
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">About Open Pitt Rooms</h1>

      <div className="mt-6 grid gap-6 leading-relaxed text-muted [&_h2]:mb-1 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-fg">
        <section>
          <h2>What it does</h2>
          <p>
            Shows which of Pitt&apos;s official student study spaces have no scheduled class or event right now — or at
            any time in the next week — and how long each one stays free.
          </p>
        </section>

        <section>
          <h2>Where the data comes from</h2>
          <p>
            Pitt&apos;s public 25Live schedule, using the registrar&apos;s own &ldquo;Student Study Spaces&rdquo; list (
            {BUILDINGS.length} buildings). We refresh a cached copy every 30 minutes rather than hitting 25Live for every
            visitor, with permission from the Office of the University Registrar. Room hours come from 25Live too.
          </p>
        </section>

        <section>
          <h2>What &ldquo;open&rdquo; means</h2>
          <p>
            Only that 25Live shows nothing scheduled. A room can still be locked, occupied by people who didn&apos;t book
            it, or booked after our last refresh. Each room links to its 25Live page so you can confirm, and if someone
            arrives with a reservation, it&apos;s theirs. Departmental rooms may be locked or prioritized for that
            department.
          </p>
        </section>

        <section>
          <h2>Privacy</h2>
          <p>
            No accounts, no cookies for tracking, no ads. &ldquo;Nearest&rdquo; sorting asks your browser for your
            location and uses it only on your device — it&apos;s never sent to our server. Saved rooms are stored in
            your browser. We count anonymous page views (Vercel Web Analytics, cookieless) to know how many people use
            the site.
          </p>
        </section>

        <section>
          <h2>Not official</h2>
          <p>
            This is an independent student project and is not affiliated with or endorsed by the University of
            Pittsburgh. Questions about room policies or reservations go to{" "}
            <a className="text-accent underline" href="mailto:rooms@registrar.pitt.edu">
              rooms@registrar.pitt.edu
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
