/**
 * Lightweight passthrough to the FastAPI /api/health endpoint.
 * Useful to confirm the Python backend is reachable from the browser.
 */
const BACKEND = process.env.BACKEND_URL || "http://localhost:8000";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/health`, { cache: "no-store" });
    const data = await res.json();
    return Response.json({ ok: true, backend: data });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: `Cannot reach FastAPI at ${BACKEND}`,
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 503 }
    );
  }
}
