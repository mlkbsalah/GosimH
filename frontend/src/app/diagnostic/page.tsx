"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SlaiAvatar } from "@/components/brand";
import {
  ArrowLeftIcon,
  ArrowUpIcon,
  CameraIcon,
  CheckIcon,
  CloseIcon,
  PinIcon,
  PlusIcon,
  RefreshIcon,
  SparkIcon,
  WrenchIcon,
} from "@/components/icons";

type Screen = "capture" | "details" | "thinking" | "result";
type Path = "diy" | "pro" | "replace";

const QUICK_TYPES = [
  "Washing machine",
  "Dishwasher",
  "Fridge",
  "Oven",
  "Microwave",
  "Dryer",
];

const AGE_OPTIONS = [
  "< 2 years",
  "2–5 years",
  "5–10 years",
  "10+ years",
  "Not sure",
];

const BUDGET_OPTIONS = [
  "Up to €50",
  "€50–150",
  "€150–300",
  "Whatever it takes",
];

const TOOL_OPTIONS = [
  "Screwdriver",
  "Multimeter",
  "Wrench",
  "Drill",
  "Pliers",
];

const THINKING_STEPS = [
  "Looking at your photos…",
  "Identifying the model…",
  "Checking common faults…",
  "Estimating cost & effort…",
];

// Mock diagnosis — to be wired to the Python backend later.
const MOCK_DIAGNOSIS = {
  appliance: "Bosch dishwasher",
  symptom: "doesn't dry the dishes",
  rootCause: "drying element (heater) likely failed",
  confidence: 0.82,
  estCost: "€25–60",
  estTime: "30 min",
  difficulty: 2,
};

export default function DiagnosticApp() {
  const [screen, setScreen] = useState<Screen>("capture");
  const [photos, setPhotos] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [type, setType] = useState<string | null>(null);
  const [path, setPath] = useState<Path>("diy");
  const [thinkingStep, setThinkingStep] = useState(0);

  // Details collected on the intermediate screen — sent to /api/diagnose later.
  const [location, setLocation] = useState("");
  const [age, setAge] = useState<string | null>(null);
  const [budget, setBudget] = useState<string | null>(null);
  const [tools, setTools] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = photos.length > 0 || text.trim().length > 0 || !!type;
  const canDiagnose =
    location.trim().length > 0 && age !== null && budget !== null;

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const next: string[] = [];
    let pending = files.length;
    Array.from(files)
      .slice(0, 4 - photos.length)
      .forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          next.push(e.target?.result as string);
          pending--;
          if (pending === 0) {
            setPhotos((prev) => [...prev, ...next].slice(0, 4));
          }
        };
        reader.readAsDataURL(file);
      });
  };

  const startThinking = () => {
    setScreen("thinking");
    setThinkingStep(0);
  };

  // Cycle the thinking copy and pick a path. Mock decides DIY by default
  // unless the user typed certain keywords.
  useEffect(() => {
    if (screen !== "thinking") return;

    const stepInterval = setInterval(() => {
      setThinkingStep((s) => Math.min(s + 1, THINKING_STEPS.length - 1));
    }, 750);

    const text_l = text.toLowerCase();
    let chosen: Path = "diy";
    if (/old|dead|broken|gas|smoke|burn|leak.*water/.test(text_l)) {
      chosen = "pro";
    }
    if (/15|20.year|years.old|too old|dead/.test(text_l)) {
      chosen = "replace";
    }

    const finishTimer = setTimeout(() => {
      setPath(chosen);
      setScreen("result");
      clearInterval(stepInterval);
    }, 3200);

    return () => {
      clearInterval(stepInterval);
      clearTimeout(finishTimer);
    };
  }, [screen, text]);

  const reset = () => {
    setScreen("capture");
    setPhotos([]);
    setText("");
    setType(null);
    setLocation("");
    setAge(null);
    setBudget(null);
    setTools([]);
    setThinkingStep(0);
  };

  const toggleTool = (tool: string) => {
    setTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  return (
    <div className="min-h-dvh bg-bone md:bg-ink/95">
      <div className="relative mx-auto flex min-h-dvh max-w-full flex-col overflow-hidden bg-bone md:my-6 md:min-h-[calc(100dvh-3rem)] md:max-w-[440px] md:rounded-[2.6rem] md:shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)] md:ring-1 md:ring-ink/20">
        {screen === "capture" && (
          <CaptureScreen
            photos={photos}
            text={text}
            type={type}
            canSubmit={canSubmit}
            fileInputRef={fileInputRef}
            onFiles={handleFiles}
            onRemovePhoto={(i) =>
              setPhotos((prev) => prev.filter((_, idx) => idx !== i))
            }
            onText={setText}
            onType={setType}
            onSubmit={() => setScreen("details")}
          />
        )}

        {screen === "details" && (
          <DetailsScreen
            location={location}
            age={age}
            budget={budget}
            tools={tools}
            canDiagnose={canDiagnose}
            onLocation={setLocation}
            onAge={setAge}
            onBudget={setBudget}
            onToggleTool={toggleTool}
            onBack={() => setScreen("capture")}
            onSubmit={startThinking}
          />
        )}

        {screen === "thinking" && (
          <ThinkingScreen step={thinkingStep} totalSteps={THINKING_STEPS.length} />
        )}

        {screen === "result" && <ResultScreen path={path} onReset={reset} />}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Screen 1 — Capture                                                        */
/* -------------------------------------------------------------------------- */

function CaptureScreen({
  photos,
  text,
  type,
  canSubmit,
  fileInputRef,
  onFiles,
  onRemovePhoto,
  onText,
  onType,
  onSubmit,
}: {
  photos: string[];
  text: string;
  type: string | null;
  canSubmit: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFiles: (f: FileList | null) => void;
  onRemovePhoto: (i: number) => void;
  onText: (t: string) => void;
  onType: (t: string | null) => void;
  onSubmit: () => void;
}) {
  return (
    <section className="screen-enter flex min-h-dvh flex-col md:min-h-[calc(100dvh-3rem)]">
      <AppHeader />

      <div className="flex-1 overflow-y-auto px-5 pb-32 pt-5">
        {/* Slaï greeting */}
        <div className="flex gap-2.5">
          <SlaiAvatar className="mt-0.5 h-8 w-8 shrink-0" />
          <div className="max-w-[88%] rounded-2xl rounded-bl-sm border border-goldseam/30 bg-goldseam/5 px-4 py-3">
            <p className="font-serif text-[15px] leading-snug text-ink">
              Hi, I&apos;m Slaï.
            </p>
            <p className="mt-1 text-[14.5px] leading-relaxed text-ink/80">
              Show me what&apos;s broken — a wide shot, the rating plate, and
              anything that looks off.
            </p>
          </div>
        </div>

        {/* Photo grid */}
        <div className="mt-6">
          <h2 className="font-sans text-[10px] uppercase tracking-[0.16em] text-ash">
            Your photos
          </h2>

          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            {photos.map((src, i) => (
              <div
                key={i}
                className="relative aspect-square overflow-hidden rounded-2xl border border-ink/10 bg-ink/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Photo ${i + 1}`}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => onRemovePhoto(i)}
                  aria-label="Remove photo"
                  className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-ink/80 text-bone backdrop-blur"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
            ))}

            {photos.length < 4 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink/25 bg-bone text-ink/60 transition active:scale-[0.98]"
              >
                <CameraIcon className="h-7 w-7" />
                <span className="font-sans text-[12px] font-medium">
                  {photos.length === 0 ? "Add photo" : "Add another"}
                </span>
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
        </div>

        {/* Quick type chips */}
        <div className="mt-7">
          <h2 className="font-sans text-[10px] uppercase tracking-[0.16em] text-ash">
            What is it?
          </h2>
          <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto pb-1">
            {QUICK_TYPES.map((t) => {
              const active = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onType(active ? null : t)}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 font-sans text-[13px] font-medium transition ${
                    active
                      ? "border-ink bg-ink text-bone"
                      : "border-ink/15 bg-bone text-ink/75 hover:border-ink/30"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* Free-form text */}
        <div className="mt-7">
          <h2 className="font-sans text-[10px] uppercase tracking-[0.16em] text-ash">
            What&apos;s wrong?
          </h2>
          <textarea
            value={text}
            onChange={(e) => onText(e.target.value)}
            rows={4}
            placeholder="It started a few days ago. The dishes come out wet and there's a faint smell when it heats up…"
            className="mt-2.5 w-full resize-none rounded-2xl border border-ink/15 bg-bone p-4 text-[14.5px] leading-relaxed text-ink placeholder:text-ash/80 focus:border-goldseam focus:outline-none"
          />
        </div>
      </div>

      {/* Bottom CTA — sticky, thumb-zone */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-ink/10 bg-bone/95 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:absolute md:rounded-b-[2.6rem]">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-4 text-[15px] font-medium text-bone transition disabled:bg-ink/30 disabled:text-bone/60 active:scale-[0.99]"
        >
          Ask Slaï
          <ArrowUpIcon className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Screen 1.5 — Details (mockup form, not wired to backend yet)              */
/* -------------------------------------------------------------------------- */

function DetailsScreen({
  location,
  age,
  budget,
  tools,
  canDiagnose,
  onLocation,
  onAge,
  onBudget,
  onToggleTool,
  onBack,
  onSubmit,
}: {
  location: string;
  age: string | null;
  budget: string | null;
  tools: string[];
  canDiagnose: boolean;
  onLocation: (v: string) => void;
  onAge: (v: string) => void;
  onBudget: (v: string) => void;
  onToggleTool: (v: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <section className="screen-enter flex min-h-dvh flex-col md:min-h-[calc(100dvh-3rem)]">
      <AppHeader showBack onBack={onBack} />

      <div className="flex-1 overflow-y-auto px-5 pb-32 pt-5">
        {/* Slaï prompt */}
        <div className="flex gap-2.5">
          <SlaiAvatar className="mt-0.5 h-8 w-8 shrink-0" />
          <div className="max-w-[88%] rounded-2xl rounded-bl-sm border border-goldseam/30 bg-goldseam/5 px-4 py-3">
            <p className="font-serif text-[15px] leading-snug text-ink">
              A few quick things.
            </p>
            <p className="mt-1 text-[14.5px] leading-relaxed text-ink/80">
              These help me decide between fixing it, calling a pro, or
              replacing it.
            </p>
          </div>
        </div>

        {/* Location */}
        <div className="mt-7">
          <h2 className="font-sans text-[10px] uppercase tracking-[0.16em] text-ash">
            Where are you?
          </h2>
          <input
            type="text"
            value={location}
            onChange={(e) => onLocation(e.target.value)}
            placeholder="Paris 11e, Lyon, Marseille…"
            className="mt-2.5 w-full rounded-2xl border border-ink/15 bg-bone px-4 py-3.5 text-[14.5px] text-ink placeholder:text-ash/80 focus:border-goldseam focus:outline-none"
          />
          <p className="mt-1.5 text-[12px] text-ink/55">
            City or neighborhood — used to find pros nearby.
          </p>
        </div>

        {/* Age */}
        <FieldChips
          label="How old is it?"
          options={AGE_OPTIONS}
          value={age}
          onChange={onAge}
          className="mt-6"
        />

        {/* Budget */}
        <FieldChips
          label="Your repair budget?"
          options={BUDGET_OPTIONS}
          value={budget}
          onChange={onBudget}
          className="mt-6"
        />

        {/* Tools — multi-select */}
        <div className="mt-6">
          <h2 className="font-sans text-[10px] uppercase tracking-[0.16em] text-ash">
            What tools do you have?
          </h2>
          <p className="mt-1 text-[12px] text-ink/55">
            Multiple choice — leave empty if none.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {TOOL_OPTIONS.map((t) => {
              const active = tools.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onToggleTool(t)}
                  className={`rounded-full border px-3.5 py-1.5 font-sans text-[13px] font-medium transition ${
                    active
                      ? "border-ink bg-ink text-bone"
                      : "border-ink/15 bg-bone text-ink/75 hover:border-ink/30"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-ink/10 bg-bone/95 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:absolute md:rounded-b-[2.6rem]">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canDiagnose}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-4 text-[15px] font-medium text-bone transition disabled:bg-ink/30 disabled:text-bone/60 active:scale-[0.99]"
        >
          Get my answer
          <ArrowUpIcon className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

function FieldChips({
  label,
  options,
  value,
  onChange,
  className = "",
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <h2 className="font-sans text-[10px] uppercase tracking-[0.16em] text-ash">
        {label}
      </h2>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value === o;
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              className={`rounded-full border px-3.5 py-1.5 font-sans text-[13px] font-medium transition ${
                active
                  ? "border-ink bg-ink text-bone"
                  : "border-ink/15 bg-bone text-ink/75 hover:border-ink/30"
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Screen 2 — Thinking                                                       */
/* -------------------------------------------------------------------------- */

function ThinkingScreen({
  step,
  totalSteps,
}: {
  step: number;
  totalSteps: number;
}) {
  return (
    <section className="screen-enter flex min-h-dvh flex-col md:min-h-[calc(100dvh-3rem)]">
      <AppHeader />

      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-10">
        {/* The Slaï mark, large, with the two pulsing dots */}
        <div className="relative grid h-32 w-32 place-items-center rounded-3xl bg-bone shadow-[0_30px_60px_-30px_rgba(26,24,20,0.3)] ring-1 ring-ink/5 sm:h-36 sm:w-36">
          <div className="font-serif text-[88px] font-medium leading-none text-ink sm:text-[100px]">
            i
          </div>
          <span
            aria-hidden
            className="dot-pulse-a absolute left-[34%] top-[18%] h-3 w-3 rounded-full bg-goldseam sm:h-3.5 sm:w-3.5"
          />
          <span
            aria-hidden
            className="dot-pulse-b absolute right-[34%] top-[18%] h-3 w-3 rounded-full bg-goldseam sm:h-3.5 sm:w-3.5"
          />
        </div>

        <p className="mt-8 font-serif text-2xl font-medium tracking-tight text-ink">
          Slaï is thinking…
        </p>
        <p className="mt-2 max-w-xs text-center text-[14.5px] leading-relaxed text-ink/60">
          Reasoning out loud — three causes, ranked by likelihood.
        </p>

        {/* Step list */}
        <ol className="mt-10 w-full max-w-xs space-y-3">
          {THINKING_STEPS.map((t, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={t} className="flex items-center gap-3">
                <span
                  className={`grid h-5 w-5 place-items-center rounded-full transition ${
                    done
                      ? "bg-sage text-bone"
                      : active
                        ? "border-2 border-goldseam"
                        : "border-2 border-ink/15"
                  }`}
                >
                  {done && <CheckIcon className="h-3 w-3" />}
                  {active && (
                    <span className="h-1.5 w-1.5 animate-ping rounded-full bg-goldseam" />
                  )}
                </span>
                <span
                  className={`font-sans text-[14px] transition ${
                    done
                      ? "text-ink/60 line-through decoration-ink/15"
                      : active
                        ? "text-ink"
                        : "text-ink/40"
                  }`}
                >
                  {t}
                </span>
              </li>
            );
          })}
        </ol>

        {/* Progress bar */}
        <div className="mt-8 h-1 w-full max-w-xs overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full bg-goldseam transition-all duration-700"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Screen 3 — Result                                                         */
/* -------------------------------------------------------------------------- */

function ResultScreen({
  path,
  onReset,
}: {
  path: Path;
  onReset: () => void;
}) {
  const config = PATH_CONFIG[path];

  return (
    <section className="screen-enter flex min-h-dvh flex-col md:min-h-[calc(100dvh-3rem)]">
      <AppHeader showBack onBack={onReset} />

      <div className="flex-1 overflow-y-auto px-5 pb-32 pt-3">
        {/* Decision card */}
        <div
          className={`rounded-3xl border p-5 ${config.cardClass}`}
        >
          <div className="flex items-center justify-between">
            <span className="font-sans text-[10px] uppercase tracking-[0.18em] opacity-70">
              Verdict
            </span>
            <span className="rounded-full bg-bone/40 px-2 py-0.5 font-sans text-[11px] font-medium">
              {Math.round(MOCK_DIAGNOSIS.confidence * 100)}% confident
            </span>
          </div>

          <h1 className="mt-3 font-serif text-3xl font-medium leading-tight">
            {config.title}
          </h1>
          <p className="mt-2 text-[14.5px] leading-relaxed opacity-90">
            {config.subtitle}
          </p>

          <div className="mt-4 flex flex-wrap gap-2 font-sans text-[12px]">
            <Pill>{MOCK_DIAGNOSIS.appliance}</Pill>
            <Pill>{MOCK_DIAGNOSIS.estCost}</Pill>
            <Pill>{MOCK_DIAGNOSIS.estTime}</Pill>
          </div>
        </div>

        {/* Slaï's reasoning */}
        <div className="mt-5 flex gap-2.5">
          <SlaiAvatar className="mt-0.5 h-8 w-8 shrink-0" />
          <div className="max-w-[88%] rounded-2xl rounded-bl-sm border border-ink/10 bg-bone px-4 py-3">
            <p className="text-[14px] leading-relaxed text-ink/85">
              I see three possible causes. Most likely:{" "}
              <span className="font-medium">
                {MOCK_DIAGNOSIS.rootCause}
              </span>
              . {config.reasoning}
            </p>
          </div>
        </div>

        {/* Path-specific content */}
        <div className="mt-6">
          {path === "diy" && <DiyContent />}
          {path === "pro" && <ProContent />}
          {path === "replace" && <ReplaceContent />}
        </div>
      </div>

      {/* Bottom CTAs */}
      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center gap-2 border-t border-ink/10 bg-bone/95 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:absolute md:rounded-b-[2.6rem]">
        <button
          type="button"
          onClick={onReset}
          aria-label="Start over"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-ink/15 bg-bone text-ink/70 transition hover:text-ink active:scale-[0.97]"
        >
          <RefreshIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={`flex flex-1 items-center justify-center gap-2 rounded-full px-6 py-4 text-[15px] font-medium transition active:scale-[0.99] ${config.ctaClass}`}
        >
          {config.cta}
        </button>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Path-specific bodies                                                       */
/* -------------------------------------------------------------------------- */

function DiyContent() {
  const steps = [
    {
      n: "01",
      title: "Cut the power",
      body: "Unplug the appliance or flip the breaker. Wait 5 minutes.",
    },
    {
      n: "02",
      title: "Access the heating element",
      body: "Remove the lower kickplate (4 screws). The element is the metal coil at the bottom of the tub.",
    },
    {
      n: "03",
      title: "Test with a multimeter",
      body: "Set to continuity. Touch both terminals. No beep = element is dead.",
    },
    {
      n: "04",
      title: "Order & swap",
      body: "Search the part number on the element itself. Same model, slot it in, reconnect.",
    },
  ];

  return (
    <>
      <SectionHeading icon={<WrenchIcon className="h-3.5 w-3.5" />}>
        Repair guide · 4 steps
      </SectionHeading>
      <ol className="mt-3 space-y-2.5">
        {steps.map((s) => (
          <li
            key={s.n}
            className="rounded-2xl border border-ink/10 bg-bone p-4"
          >
            <div className="flex items-start gap-3">
              <span className="font-sans text-[11px] tracking-[0.14em] text-goldseam">
                {s.n}
              </span>
              <div className="flex-1">
                <h3 className="font-serif text-[17px] font-medium text-ink">
                  {s.title}
                </h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink/70">
                  {s.body}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <SectionHeading className="mt-6" icon={<CheckIcon className="h-3.5 w-3.5" />}>
        What you&apos;ll need
      </SectionHeading>
      <div className="mt-3 flex flex-wrap gap-2 font-sans text-[12.5px]">
        {["Phillips screwdriver", "Multimeter", "Replacement part (~€35)"].map(
          (t) => (
            <span
              key={t}
              className="rounded-full border border-ink/15 bg-bone px-3 py-1.5 text-ink/80"
            >
              {t}
            </span>
          )
        )}
      </div>
    </>
  );
}

function ProContent() {
  const pros = [
    {
      name: "Atelier Réparation Bastille",
      address: "12 rue de la Roquette · Paris 11",
      rating: 4.7,
      reviews: 213,
      open: true,
    },
    {
      name: "ElectroFix Marais",
      address: "5 rue Charlot · Paris 3",
      rating: 4.5,
      reviews: 88,
      open: false,
    },
    {
      name: "Bosch Service République",
      address: "8 av. de la République · Paris 11",
      rating: 4.3,
      reviews: 154,
      open: true,
    },
  ];

  return (
    <>
      <SectionHeading icon={<PinIcon className="h-3.5 w-3.5" />}>
        Three pros near you
      </SectionHeading>
      <ul className="mt-3 space-y-2.5">
        {pros.map((p) => (
          <li
            key={p.name}
            className="rounded-2xl border border-ink/10 bg-bone p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-serif text-[17px] font-medium text-ink">
                  {p.name}
                </h3>
                <p className="mt-0.5 text-[13px] text-ink/60">{p.address}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 font-sans text-[11px] font-medium ${
                  p.open
                    ? "bg-sage/15 text-sage"
                    : "bg-ash/15 text-ash"
                }`}
              >
                {p.open ? "Open now" : "Closed"}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 font-sans text-[12.5px] text-ink/70">
              <span className="font-medium text-ink">★ {p.rating}</span>
              <span className="text-ash">·</span>
              <span>{p.reviews} reviews</span>
            </div>
          </li>
        ))}
      </ul>

      <SectionHeading className="mt-6" icon={<SparkIcon className="h-3.5 w-3.5" />}>
        Ask them this
      </SectionHeading>
      <ul className="mt-3 space-y-2 text-[13.5px] leading-relaxed text-ink/80">
        <li className="rounded-xl border border-ink/10 bg-bone px-3.5 py-2.5">
          “Can you replace the drying element on a Bosch dishwasher?”
        </li>
        <li className="rounded-xl border border-ink/10 bg-bone px-3.5 py-2.5">
          “Flat rate or hourly? Is the part included?”
        </li>
        <li className="rounded-xl border border-ink/10 bg-bone px-3.5 py-2.5">
          “How long is the warranty on the repair?”
        </li>
      </ul>
    </>
  );
}

function ReplaceContent() {
  const items = [
    {
      brand: "Miele G 5000",
      price: "€649",
      tag: "Best value",
      note: "10-yr expected lifespan, A-rated drying.",
    },
    {
      brand: "Bosch Serie 4",
      price: "€459",
      tag: "Same brand",
      note: "Familiar UI, easy parts replacement later.",
    },
    {
      brand: "Refurb · Siemens iQ500",
      price: "€289",
      tag: "Refurbished",
      note: "12-month warranty. Saves ~120 kg CO₂.",
    },
  ];

  return (
    <>
      <SectionHeading icon={<CheckIcon className="h-3.5 w-3.5" />}>
        Three smart options
      </SectionHeading>
      <ul className="mt-3 space-y-2.5">
        {items.map((it) => (
          <li
            key={it.brand}
            className="rounded-2xl border border-ink/10 bg-bone p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="rounded-full bg-goldseam/15 px-2 py-0.5 font-sans text-[10.5px] font-medium uppercase tracking-[0.1em] text-goldseam">
                  {it.tag}
                </span>
                <h3 className="mt-1.5 font-serif text-[17px] font-medium text-ink">
                  {it.brand}
                </h3>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink/65">
                  {it.note}
                </p>
              </div>
              <span className="shrink-0 font-serif text-lg font-medium text-ink">
                {it.price}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Reusable bits                                                             */
/* -------------------------------------------------------------------------- */

function AppHeader({
  showBack = false,
  onBack,
}: {
  showBack?: boolean;
  onBack?: () => void;
}) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-ink/10 bg-bone/85 px-4 py-3 backdrop-blur md:rounded-t-[2.6rem]">
      {showBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Start over"
          className="grid h-9 w-9 place-items-center rounded-full text-ink/70 hover:bg-ink/5"
        >
          <ArrowLeftIcon className="h-[18px] w-[18px]" />
        </button>
      ) : (
        <Link
          href="/"
          aria-label="Close"
          className="grid h-9 w-9 place-items-center rounded-full text-ink/70 hover:bg-ink/5"
        >
          <CloseIcon className="h-4 w-4" />
        </Link>
      )}

      <div className="flex items-center gap-2">
        <SlaiAvatar className="h-6 w-6" />
        <span className="font-serif text-[15px] font-medium tracking-tight text-ink">
          Slaï
        </span>
      </div>

      <div className="h-9 w-9" aria-hidden />
    </header>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-bone/60 px-2.5 py-0.5 font-medium ring-1 ring-ink/10">
      {children}
    </span>
  );
}

function SectionHeading({
  children,
  icon,
  className = "",
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`flex items-center gap-1.5 font-sans text-[10.5px] uppercase tracking-[0.16em] text-ash ${className}`}
    >
      {icon}
      {children}
    </h2>
  );
}

/* -------------------------------------------------------------------------- */
/*  Path config                                                                */
/* -------------------------------------------------------------------------- */

const PATH_CONFIG: Record<
  Path,
  {
    title: string;
    subtitle: string;
    reasoning: string;
    cta: string;
    cardClass: string;
    ctaClass: string;
  }
> = {
  diy: {
    title: "You can fix this yourself.",
    subtitle:
      "Honestly — it's a 30-minute job with what you already have at home.",
    reasoning:
      "It's a known fault, the part is cheap, and you have the tools. Skip the call-out fee.",
    cta: "Start the repair",
    cardClass: "border-sage/30 bg-sage/10 text-ink",
    ctaClass: "bg-ink text-bone hover:bg-ink/85",
  },
  pro: {
    title: "Best to call a pro.",
    subtitle:
      "It needs hands-on testing and a tool you probably don't own.",
    reasoning:
      "Don't risk a water or electrical issue. A repairer will diagnose and fix in one visit.",
    cta: "Find a repairer",
    cardClass: "border-goldseam/30 bg-goldseam/15 text-ink",
    ctaClass: "bg-ink text-bone hover:bg-ink/85",
  },
  replace: {
    title: "Replace it — honestly.",
    subtitle:
      "Repair would cost more than half the price of a refurbished one.",
    reasoning:
      "It's at the end of its design life. Replacing now is cheaper, and a refurbished unit saves materials.",
    cta: "See alternatives",
    cardClass: "border-ink/15 bg-ink/[0.06] text-ink",
    ctaClass: "bg-goldseam text-ink hover:bg-goldseam/90",
  },
};
