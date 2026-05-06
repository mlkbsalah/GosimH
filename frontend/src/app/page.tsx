import Link from "next/link";
import { SlaiAvatar, WordmarkSecondlife } from "@/components/brand";

const steps = [
  {
    n: "01",
    title: "Show",
    body: "Snap a few photos. Wide shot, rating plate, anything off.",
  },
  {
    n: "02",
    title: "Talk",
    body: "Your tools, budget, location, and what feels wrong.",
  },
  {
    n: "03",
    title: "Decide",
    body: "DIY guide, vetted local pros, or smart replacement options.",
  },
];

const paths = [
  {
    label: "Fix it yourself",
    badge: "border-sage/30 bg-sage/10 text-sage",
    body: "Step-by-step, with the tools you already keep in the drawer.",
  },
  {
    label: "Call a pro",
    badge: "border-goldseam/30 bg-goldseam/10 text-goldseam",
    body: "Local repairers, real reviews, the right questions to ask.",
  },
  {
    label: "Replace smartly",
    badge: "border-ink/20 bg-ink/5 text-ink",
    body: "Refurbished deals, recommended models, a clear baseline.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Header — compact on mobile */}
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-bone/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-8 sm:py-4">
          <Link
            href="/"
            aria-label="secondlife — home"
            className="flex items-center gap-2 text-ink"
          >
            <SlaiAvatar className="h-7 w-7 sm:h-8 sm:w-8" />
            <span className="font-serif text-lg font-medium tracking-tight sm:text-2xl">
              secondlife
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-ink/70 md:flex">
            <a href="#how" className="hover:text-ink">
              How it works
            </a>
            <a href="#paths" className="hover:text-ink">
              Solutions
            </a>
            <a href="#about" className="hover:text-ink">
              About
            </a>
          </nav>
          <Link
            href="/diagnostic"
            className="hidden rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bone transition hover:bg-ink/85 md:inline-flex"
          >
            Start
          </Link>
        </div>
      </header>

      <main className="flex-1 pb-24 md:pb-0">
        {/* HERO — designed for one-thumb mobile first */}
        <section className="px-4 pt-8 pb-12 sm:px-8 sm:pt-16 sm:pb-20 lg:pb-28">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-goldseam/30 bg-goldseam/10 px-2.5 py-1 font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-goldseam sm:text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full bg-goldseam" />
                GOSIM Hackathon · 2026
              </span>

              <h1 className="mt-4 font-serif text-[1.9rem] leading-[1.08] tracking-[-0.015em] text-ink sm:mt-5 sm:text-5xl lg:text-7xl">
                Before you toss it,
                <br className="hidden xs:block sm:block" />{" "}
                <span className="italic text-ink/80">ask </span>
                <span className="relative inline-block">
                  Sla
                  <span className="relative">
                    i
                    <span
                      aria-hidden
                      className="absolute -top-2.5 left-1/2 flex -translate-x-1/2 gap-[3px] sm:-top-3.5 sm:gap-1"
                    >
                      <span className="h-1 w-1 rounded-full bg-goldseam sm:h-1.5 sm:w-1.5" />
                      <span className="h-1 w-1 rounded-full bg-goldseam sm:h-1.5 sm:w-1.5" />
                    </span>
                  </span>
                </span>
                .
              </h1>

              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink/75 sm:mt-5 sm:max-w-xl sm:text-base lg:text-lg">
                Show your broken appliance. Get an honest answer — fix it
                yourself, find a pro, or replace it smartly.
              </p>

              {/* On mobile: single full-width CTA. Secondary as text link below. */}
              <div className="mt-6 flex flex-col gap-3 sm:mt-7 sm:flex-row sm:items-center">
                <Link
                  href="/diagnostic"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-4 text-sm font-medium text-bone transition hover:bg-ink/85 sm:w-auto sm:py-3.5"
                >
                  Diagnose my appliance
                  <span aria-hidden>→</span>
                </Link>
                <a
                  href="#how"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full text-sm font-medium text-ink/70 transition hover:text-ink sm:rounded-full sm:border sm:border-ink/20 sm:bg-transparent sm:px-6 sm:py-3.5"
                >
                  See how it works
                  <span aria-hidden className="sm:hidden">
                    →
                  </span>
                </a>
              </div>

              {/* Stats: 2 on mobile, 3 from sm+ */}
              <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-ink/10 pt-6 sm:mt-10 sm:grid-cols-3 sm:gap-8">
                <div>
                  <dt className="font-sans text-[10px] uppercase tracking-[0.14em] text-ash">
                    Diagnose in
                  </dt>
                  <dd className="mt-1 font-serif text-2xl font-medium sm:text-3xl">
                    ~30s
                  </dd>
                </div>
                <div>
                  <dt className="font-sans text-[10px] uppercase tracking-[0.14em] text-ash">
                    Paths
                  </dt>
                  <dd className="mt-1 font-serif text-2xl font-medium sm:text-3xl">
                    3
                  </dd>
                </div>
                <div className="hidden sm:block">
                  <dt className="font-sans text-[10px] uppercase tracking-[0.14em] text-ash">
                    Appliances
                  </dt>
                  <dd className="mt-1 font-serif text-2xl font-medium sm:text-3xl">
                    7+
                  </dd>
                </div>
              </dl>
            </div>

            {/* Slaï preview — compact on mobile, expanded on desktop */}
            <aside className="relative">
              <div className="rounded-2xl border border-ink/10 bg-bone p-4 shadow-[0_20px_50px_-30px_rgba(26,24,20,0.25)] sm:rounded-3xl sm:p-6">
                <div className="flex items-center gap-3 border-b border-ink/10 pb-3 sm:pb-4">
                  <SlaiAvatar className="h-8 w-8 sm:h-9 sm:w-9" />
                  <div className="flex flex-col">
                    <span className="font-serif text-sm font-medium leading-tight">
                      Slaï
                    </span>
                    <span className="font-sans text-[10px] uppercase tracking-[0.12em] text-ash sm:text-[11px]">
                      Diagnosing · live
                    </span>
                  </div>
                  <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-sage" />
                </div>

                <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
                  <div className="flex justify-end">
                    <div className="max-w-[88%] rounded-2xl rounded-br-sm bg-ink/5 px-3.5 py-2.5 text-[13.5px] text-ink sm:px-4 sm:py-3 sm:text-sm">
                      My Bosch dishwasher isn&apos;t drying anymore.
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <SlaiAvatar className="mt-0.5 h-7 w-7 shrink-0 sm:mt-1" />
                    <div className="max-w-[88%] rounded-2xl rounded-bl-sm border border-goldseam/30 bg-goldseam/5 px-3.5 py-3 text-[13.5px] text-ink sm:px-4 sm:py-3 sm:text-sm">
                      <p className="font-medium">
                        Three possible causes. Most likely: the drying element.
                      </p>
                      <p className="mt-1.5 text-ink/75">
                        <span className="font-medium">€25–60</span>. Doable
                        with what you have.
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-1.5 font-sans text-[10.5px] sm:text-[11px]">
                        <span className="rounded-full bg-bone px-2.5 py-0.5 text-sage">
                          DIY · 30 min
                        </span>
                        <span className="rounded-full bg-bone px-2.5 py-0.5 text-ink/80">
                          Screwdriver ✓
                        </span>
                        <span className="rounded-full bg-bone px-2.5 py-0.5 text-ink/80">
                          Multimeter ✓
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-3 right-2 rotate-[2deg] rounded-xl bg-ink px-3 py-1.5 text-[11px] font-medium text-bone shadow-md sm:-bottom-4 sm:right-3 sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-xs lg:-bottom-5 lg:-right-4">
                Saves €200 vs new
              </div>
            </aside>
          </div>
        </section>

        {/* HOW — horizontal scroll on mobile, grid on sm+ */}
        <section
          id="how"
          className="border-t border-ink/10 bg-bone py-12 sm:py-24"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <div className="max-w-2xl">
              <span className="font-sans text-[10px] uppercase tracking-[0.16em] text-ash sm:text-[11px]">
                How it works
              </span>
              <h2 className="mt-2 font-serif text-[1.7rem] leading-[1.15] tracking-tight text-ink sm:mt-3 sm:text-5xl">
                Three steps,
                <br className="hidden sm:block" /> one honest answer.
              </h2>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink/75 sm:mt-4 sm:text-lg">
                Computer vision plus reasoning agents — no jargon, no upsell.
              </p>
            </div>
          </div>

          {/* Mobile: horizontal scroll. sm+: grid. */}
          <ol className="mt-7 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-auto sm:mt-12 sm:grid sm:max-w-6xl sm:snap-none sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:px-8 sm:pb-0">
            {steps.map((step) => (
              <li
                key={step.n}
                className="w-[78%] shrink-0 snap-start rounded-2xl border border-ink/10 bg-bone p-5 transition hover:border-goldseam/40 sm:w-auto sm:p-6"
              >
                <span className="font-sans text-[11px] tracking-[0.14em] text-goldseam">
                  {step.n}
                </span>
                <h3 className="mt-2 font-serif text-xl font-medium text-ink sm:mt-3 sm:text-2xl">
                  {step.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink/70 sm:mt-3 sm:text-sm">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* PATHS */}
        <section id="paths" className="px-4 py-12 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <span className="font-sans text-[10px] uppercase tracking-[0.16em] text-ash sm:text-[11px]">
                Solutions
              </span>
              <h2 className="mt-2 font-serif text-[1.7rem] leading-[1.15] tracking-tight text-ink sm:mt-3 sm:text-5xl">
                Three possible paths.
              </h2>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink/75 sm:mt-4 sm:text-lg">
                Sometimes replacing really is the right call. Slaï tells you
                when.
              </p>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:mt-12 sm:grid sm:grid-cols-3 sm:gap-6">
              {paths.map((path) => (
                <article
                  key={path.label}
                  className="flex flex-col rounded-2xl border border-ink/10 bg-bone p-5 sm:p-6"
                >
                  <span
                    className={`inline-flex w-fit items-center rounded-full border px-3 py-1 font-sans text-[10px] font-medium uppercase tracking-[0.12em] sm:text-[11px] ${path.badge}`}
                  >
                    {path.label}
                  </span>
                  <p className="mt-3.5 text-[14px] leading-relaxed text-ink/75 sm:mt-5 sm:text-sm">
                    {path.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ABOUT — kintsugi statement */}
        <section
          id="about"
          className="border-t border-ink/10 bg-ink px-4 py-16 text-bone sm:px-8 sm:py-28"
        >
          <div className="mx-auto max-w-3xl text-center">
            <span className="font-sans text-[10px] uppercase tracking-[0.18em] text-goldseam sm:text-[11px]">
              Why we built it
            </span>
            <h2 className="mt-3 font-serif text-[1.9rem] leading-[1.15] tracking-tight sm:mt-4 sm:text-5xl">
              Repair is a stance.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-bone/80 sm:mt-6 sm:text-lg">
              Like kintsugi mends pottery with gold instead of hiding the
              crack, Slaï shows the seam — the reasoning, the cost, the
              tradeoff — so you can make the call yourself.
            </p>
            <Link
              href="/diagnostic"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-goldseam px-6 py-3.5 text-sm font-medium text-ink transition hover:bg-goldseam/90 sm:mt-9"
            >
              Try it on your appliance
              <span aria-hidden>→</span>
            </Link>
          </div>
        </section>
      </main>

      {/* Sticky bottom CTA — mobile-only, thumb-zone */}
      <div
        aria-hidden="false"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-bone/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden"
      >
        <Link
          href="/diagnostic"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-bone shadow-[0_10px_30px_-10px_rgba(26,24,20,0.4)] active:scale-[0.99]"
        >
          Diagnose my appliance
          <span aria-hidden>→</span>
        </Link>
      </div>

      <footer className="border-t border-ink/10 bg-bone px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-ash sm:flex-row">
          <div className="flex items-center gap-3">
            <WordmarkSecondlife className="h-4 w-auto text-ink sm:h-5" />
            <span className="text-ash/80">© 2026</span>
          </div>
          <p className="font-sans text-[10px] uppercase tracking-[0.14em] sm:text-[11px]">
            slaï · second life ai · gosim
          </p>
        </div>
      </footer>
    </div>
  );
}
