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
  RefreshIcon,
  SparkIcon,
  WrenchIcon,
} from "@/components/icons";

type Screen = "capture" | "details" | "thinking" | "result";
type Path = "diy" | "pro" | "replace";

/* Backend response shapes — mirror object_identification.py + phase3.py. */
type IdentifyResult = {
  type?: string;
  brand?: string | null;
  model?: string | null;
  serial?: string | null;
  error_code?: string | null;
  visible_symptoms?: string[];
  confidence?: number;
};

/* Mirrors phase3 v3 output (all keys in English, see backend/phase3.py). */
type Triage = {
  decision: "diy" | "repair" | "replacement";
  reason?: string;
  difficulty?: number;
  estimated_repair_cost?: string;
  estimated_new_price?: string;
};

type DiyGuide = {
  title?: string;
  estimated_duration?: string;
  difficulty?: string;
  parts_needed?: string[];
  tools_needed?: string[];
  steps?: {
    number?: number;
    title?: string;
    description?: string;
    warning?: string | null;
  }[];
  tips?: string[];
  sources?: string[];
};

type RepairResults = {
  shops?: {
    name?: string;
    address?: string;
    rating?: number | null;
    reviews?: number | null;
    open_now?: boolean | null;
    google_maps_url?: string;
  }[];
  questions_to_ask?: string[];
  required_skills?: string[];
  max_budget?: string;
  advice?: string;
  source?: string;
};

type Alternatives = {
  analysis?: string;
  criteria?: string[];
  recommended_models?: {
    brand?: string;
    model?: string;
    estimated_price?: string;
    highlights?: string[];
    leboncoin_query?: string;
    amazon_query?: string;
  }[];
  buying_tips?: string[];
  search_links?: { leboncoin?: string; fnac?: string; amazon?: string };
};

type Diagnosis = {
  status?: string;
  appliance?: string;
  decision: "diy" | "repair" | "replacement";
  solution: {
    type: "diy" | "repair" | "replacement";
    triage?: Triage;
    guide?: DiyGuide;
    results?: RepairResults;
    alternatives?: Alternatives;
  };
};

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

/* Map UI chip values to phase3.run_phase3() expected types. */
const CURRENT_YEAR = 2026;
const AGE_TO_YEAR: Record<string, string> = {
  "< 2 years": String(CURRENT_YEAR - 1),
  "2–5 years": String(CURRENT_YEAR - 4),
  "5–10 years": String(CURRENT_YEAR - 7),
  "10+ years": String(CURRENT_YEAR - 12),
  "Not sure": "",
};

const BUDGET_TO_VALUE: Record<string, number> = {
  "Up to €50": 50,
  "€50–150": 150,
  "€150–300": 300,
  "Whatever it takes": 1000,
};

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

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

  // Backend response state.
  const [identification, setIdentification] = useState<IdentifyResult | null>(
    null
  );
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // Real backend pipeline: identify (vision) → diagnose (agents).
  // Step indicator cycles independently — finishes when the diagnose call
  // resolves, regardless of how long phase3 takes (~20-40s).
  useEffect(() => {
    if (screen !== "thinking") return;

    let cancelled = false;
    let step = 0;
    const stepInterval = setInterval(() => {
      if (cancelled) return;
      step = Math.min(step + 1, THINKING_STEPS.length - 1);
      setThinkingStep(step);
    }, 2200);

    (async () => {
      try {
        // 1) Identify (only if photos uploaded).
        let ident: IdentifyResult | null = null;
        if (photos.length > 0) {
          const fd = new FormData();
          for (const dataUrl of photos) {
            const blob = await dataUrlToBlob(dataUrl);
            fd.append("photos", blob, "photo.jpg");
          }
          if (text.trim()) fd.append("hint", text);

          const r = await fetch("/api/identify", { method: "POST", body: fd });
          if (r.ok) {
            const data = await r.json();
            if (data.ok && data.result) ident = data.result;
          }
        }

        if (cancelled) return;
        setIdentification(ident);

        // 2) Diagnose — assemble the phase3 v3 payload (English keys).
        const payload = {
          appliance:
            ident?.type?.replace(/_/g, " ") ||
            (type ?? "").toLowerCase() ||
            "appliance",
          brand: ident?.brand ?? "",
          year: AGE_TO_YEAR[age ?? ""] ?? "",
          diagnosis:
            text.trim() || (ident?.visible_symptoms ?? []).join(", "),
          tools: tools.map((t) => t.toLowerCase()),
          location,
          budget: BUDGET_TO_VALUE[budget ?? ""] ?? 100,
        };

        const r2 = await fetch("/api/diagnose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!r2.ok) {
          const detail = await r2.text();
          throw new Error(`Diagnose failed (${r2.status}): ${detail}`);
        }

        const diag = (await r2.json()) as Diagnosis;
        if (cancelled) return;

        setDiagnosis(diag);
        setError(null);

        const decisionMap: Record<string, Path> = {
          diy: "diy",
          repair: "pro",
          replacement: "replace",
        };
        setPath(decisionMap[diag.decision] ?? "diy");
        setScreen("result");
      } catch (err) {
        if (cancelled) return;
        // Log + fall back gracefully — show the result screen with a banner.
        // eslint-disable-next-line no-console
        console.error("Diagnostic API failed:", err);
        setError(err instanceof Error ? err.message : String(err));
        setDiagnosis(null);
        setScreen("result");
      } finally {
        clearInterval(stepInterval);
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(stepInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

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
    setIdentification(null);
    setDiagnosis(null);
    setError(null);
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

        {screen === "result" && (
          <ResultScreen
            path={path}
            diagnosis={diagnosis}
            identification={identification}
            error={error}
            onReset={reset}
          />
        )}
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
  diagnosis,
  identification,
  error,
  onReset,
}: {
  path: Path;
  diagnosis: Diagnosis | null;
  identification: IdentifyResult | null;
  error: string | null;
  onReset: () => void;
}) {
  const config = PATH_CONFIG[path];
  const triage = diagnosis?.solution?.triage;

  // Display values — prefer real data, fall back gracefully so the demo
  // never shows broken UI even if the agent timed out.
  const applianceLabel =
    diagnosis?.appliance?.trim() ||
    [identification?.brand, identification?.type?.replace(/_/g, " ")]
      .filter(Boolean)
      .join(" ") ||
    "your appliance";

  const cost = triage?.estimated_repair_cost;
  const newPrice = triage?.estimated_new_price;
  const reasoning = triage?.reason || config.reasoning;
  const rootCause =
    identification?.visible_symptoms?.[0] ||
    "based on what you described";
  const confidence = identification?.confidence;

  return (
    <section className="screen-enter flex min-h-dvh flex-col md:min-h-[calc(100dvh-3rem)]">
      <AppHeader showBack onBack={onReset} />

      <div className="flex-1 overflow-y-auto px-5 pb-32 pt-3">
        {error && (
          <div className="mb-4 rounded-2xl border border-goldseam/40 bg-goldseam/10 px-4 py-3 text-[13px] leading-relaxed text-ink/80">
            <strong className="font-medium text-ink">Heads up — </strong>
            Slaï hit a snag reaching the reasoning agents. Showing a sample
            answer so you can still see the flow.
          </div>
        )}

        {/* Decision card */}
        <div className={`rounded-3xl border p-5 ${config.cardClass}`}>
          <div className="flex items-center justify-between">
            <span className="font-sans text-[10px] uppercase tracking-[0.18em] opacity-70">
              Verdict
            </span>
            {confidence !== undefined && (
              <span className="rounded-full bg-bone/40 px-2 py-0.5 font-sans text-[11px] font-medium">
                {Math.round(confidence * 100)}% confident
              </span>
            )}
          </div>

          <h1 className="mt-3 font-serif text-3xl font-medium leading-tight">
            {config.title}
          </h1>
          <p className="mt-2 text-[14.5px] leading-relaxed opacity-90">
            {config.subtitle}
          </p>

          <div className="mt-4 flex flex-wrap gap-2 font-sans text-[12px]">
            <Pill>{applianceLabel}</Pill>
            {cost && <Pill>Repair · {cost}</Pill>}
            {newPrice && <Pill>New · {newPrice}</Pill>}
          </div>
        </div>

        {/* Slaï's reasoning */}
        <div className="mt-5 flex gap-2.5">
          <SlaiAvatar className="mt-0.5 h-8 w-8 shrink-0" />
          <div className="max-w-[88%] rounded-2xl rounded-bl-sm border border-ink/10 bg-bone px-4 py-3">
            <p className="text-[14px] leading-relaxed text-ink/85">
              <span className="font-medium">{rootCause}</span> — {reasoning}
            </p>
          </div>
        </div>

        {/* Path-specific content */}
        <div className="mt-6">
          {path === "diy" && (
            <DiyContent guide={diagnosis?.solution?.guide} />
          )}
          {path === "pro" && (
            <ProContent results={diagnosis?.solution?.results} />
          )}
          {path === "replace" && (
            <ReplaceContent
              alternatives={diagnosis?.solution?.alternatives}
            />
          )}
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

const FALLBACK_DIY_STEPS: { n: string; title: string; body: string; warning?: string | null }[] = [
  {
    n: "01",
    title: "Cut the power",
    body: "Unplug the appliance or flip the breaker. Wait 5 minutes.",
  },
  {
    n: "02",
    title: "Access the part",
    body: "Remove the panel that hides the suspected faulty component.",
  },
  {
    n: "03",
    title: "Test & swap",
    body: "Confirm the fault with a multimeter, then order and replace.",
  },
];

const FALLBACK_DIY_TOOLS = ["Phillips screwdriver", "Multimeter"];

function DiyContent({ guide }: { guide?: DiyGuide | null }) {
  const steps =
    guide?.steps && guide.steps.length > 0
      ? guide.steps.map((e, i) => ({
          n: String(e.number ?? i + 1).padStart(2, "0"),
          title: e.title ?? `Step ${i + 1}`,
          body: e.description ?? "",
          warning: e.warning ?? null,
        }))
      : FALLBACK_DIY_STEPS;

  const tools =
    guide?.tools_needed && guide.tools_needed.length > 0
      ? guide.tools_needed
      : FALLBACK_DIY_TOOLS;

  const tips = guide?.tips ?? [];

  return (
    <>
      <SectionHeading icon={<WrenchIcon className="h-3.5 w-3.5" />}>
        {guide?.title ? guide.title : `Repair guide · ${steps.length} steps`}
        {guide?.estimated_duration ? ` · ${guide.estimated_duration}` : ""}
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
                {s.warning && (
                  <p className="mt-2 rounded-lg bg-goldseam/10 px-2.5 py-1.5 text-[12.5px] text-goldseam">
                    ⚠ {s.warning}
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <SectionHeading className="mt-6" icon={<CheckIcon className="h-3.5 w-3.5" />}>
        What you&apos;ll need
      </SectionHeading>
      <div className="mt-3 flex flex-wrap gap-2 font-sans text-[12.5px]">
        {tools.map((t) => (
          <span
            key={t}
            className="rounded-full border border-ink/15 bg-bone px-3 py-1.5 text-ink/80"
          >
            {t}
          </span>
        ))}
      </div>

      {tips.length > 0 && (
        <>
          <SectionHeading
            className="mt-6"
            icon={<SparkIcon className="h-3.5 w-3.5" />}
          >
            Slaï&apos;s tips
          </SectionHeading>
          <ul className="mt-3 space-y-2 text-[13.5px] leading-relaxed text-ink/80">
            {tips.map((t, i) => (
              <li
                key={i}
                className="rounded-xl border border-ink/10 bg-bone px-3.5 py-2.5"
              >
                {t}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

const FALLBACK_QUESTIONS = [
  "Flat rate or hourly? Is the part included?",
  "How long is the warranty on the repair?",
  "Do you have the part in stock?",
];

function ProContent({ results }: { results?: RepairResults | null }) {
  const pros = results?.shops ?? [];
  const questions =
    results?.questions_to_ask && results.questions_to_ask.length > 0
      ? results.questions_to_ask
      : FALLBACK_QUESTIONS;

  return (
    <>
      <SectionHeading icon={<PinIcon className="h-3.5 w-3.5" />}>
        {pros.length > 0
          ? `${pros.length} pro${pros.length > 1 ? "s" : ""} near you`
          : "Pros near you"}
      </SectionHeading>
      {pros.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-ink/10 bg-bone p-4 text-[13.5px] leading-relaxed text-ink/65">
          We couldn&apos;t fetch local repairers right now. Try a Google
          Maps search with your appliance and city.
        </p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {pros.map((p, i) => {
            const inner = (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-serif text-[17px] font-medium text-ink">
                      {p.name || "Repair shop"}
                    </h3>
                    {p.address && (
                      <p className="mt-0.5 text-[13px] text-ink/60">
                        {p.address}
                      </p>
                    )}
                  </div>
                  {p.open_now !== null && p.open_now !== undefined && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 font-sans text-[11px] font-medium ${
                        p.open_now
                          ? "bg-sage/15 text-sage"
                          : "bg-ash/15 text-ash"
                      }`}
                    >
                      {p.open_now ? "Open now" : "Closed"}
                    </span>
                  )}
                </div>
                {p.rating !== null && p.rating !== undefined && (
                  <div className="mt-2 flex items-center gap-2 font-sans text-[12.5px] text-ink/70">
                    <span className="font-medium text-ink">★ {p.rating}</span>
                    {p.reviews !== null && p.reviews !== undefined && (
                      <>
                        <span className="text-ash">·</span>
                        <span>{p.reviews} reviews</span>
                      </>
                    )}
                  </div>
                )}
              </>
            );

            return (
              <li
                key={`${p.name}-${i}`}
                className="rounded-2xl border border-ink/10 bg-bone p-4 transition hover:border-goldseam/40"
              >
                {p.google_maps_url ? (
                  <a
                    href={p.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    {inner}
                  </a>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}

      <SectionHeading
        className="mt-6"
        icon={<SparkIcon className="h-3.5 w-3.5" />}
      >
        Ask them this
      </SectionHeading>
      <ul className="mt-3 space-y-2 text-[13.5px] leading-relaxed text-ink/80">
        {questions.map((q, i) => (
          <li
            key={i}
            className="rounded-xl border border-ink/10 bg-bone px-3.5 py-2.5"
          >
            “{q}”
          </li>
        ))}
      </ul>

      {results?.advice && (
        <p className="mt-4 rounded-xl border border-goldseam/30 bg-goldseam/5 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink/80">
          {results.advice}
        </p>
      )}
    </>
  );
}

function ReplaceContent({
  alternatives,
}: {
  alternatives?: Alternatives | null;
}) {
  const models = alternatives?.recommended_models ?? [];
  const links = alternatives?.search_links;

  return (
    <>
      <SectionHeading icon={<CheckIcon className="h-3.5 w-3.5" />}>
        {models.length > 0
          ? `${models.length} smart option${models.length > 1 ? "s" : ""}`
          : "Smart options"}
      </SectionHeading>

      {models.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-ink/10 bg-bone p-4 text-[13.5px] leading-relaxed text-ink/65">
          {alternatives?.analysis ||
            "Browse refurbished and new options on the marketplaces below."}
        </p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {models.map((m, i) => (
            <li
              key={`${m.brand}-${m.model}-${i}`}
              className="rounded-2xl border border-ink/10 bg-bone p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h3 className="font-serif text-[17px] font-medium text-ink">
                    {[m.brand, m.model].filter(Boolean).join(" ")}
                  </h3>
                  {m.highlights && m.highlights.length > 0 && (
                    <p className="mt-1 text-[13px] leading-relaxed text-ink/65">
                      {m.highlights.join(" · ")}
                    </p>
                  )}
                </div>
                {m.estimated_price && (
                  <span className="shrink-0 font-serif text-lg font-medium text-ink">
                    {m.estimated_price}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {links && (
        <>
          <SectionHeading
            className="mt-6"
            icon={<SparkIcon className="h-3.5 w-3.5" />}
          >
            Search elsewhere
          </SectionHeading>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {([
              ["Leboncoin", links.leboncoin],
              ["Fnac", links.fnac],
              ["Amazon", links.amazon],
            ] as const)
              .filter(([, url]) => !!url)
              .map(([label, url]) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl border border-ink/10 bg-bone px-3 py-2.5 text-center font-sans text-[12.5px] font-medium text-ink/80 transition hover:border-goldseam/40 hover:text-ink"
                >
                  {label}
                </a>
              ))}
          </div>
        </>
      )}
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
