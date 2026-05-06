/**
 * Proxy: browser POST → /api/identify → FastAPI :8000/api/identify
 *
 * Forwards the multipart body unchanged. We don't parse it server-side because
 * Python identify() expects file uploads and we want to keep the boundary
 * intact.
 */
const BACKEND = process.env.BACKEND_URL || "http://localhost:8000";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return Response.json(
      { ok: false, error: "Expected multipart/form-data" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`${BACKEND}/api/identify`, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: req.body,
      // Required by Node's undici fetch when streaming a request body.
      // @ts-expect-error — `duplex` is part of RequestInit at runtime.
      duplex: "half",
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
