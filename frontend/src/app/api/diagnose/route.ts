/**
 * Proxy: browser POST → /api/diagnose → FastAPI :8000/api/diagnose
 *
 * The phase3 agents make several LLM calls and can take 20-40 seconds.
 * We don't add a timeout here — the browser controls that via AbortController.
 */
const BACKEND = process.env.BACKEND_URL || "http://localhost:8000";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`${BACKEND}/api/diagnose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: `Cannot reach FastAPI at ${BACKEND}`,
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}
