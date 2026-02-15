import { recordAccess, readClientIp } from "@/lib/access-logs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...extra,
  };
}

async function readBody(request) {
  try {
    const text = await request.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request) {
  try {
    const body = await readBody(request);
    const clientIdCookie = request.cookies.get("access_client_id")?.value ?? "";

    await recordAccess({
      path: body.path || "/",
      referer: body.referer || request.headers.get("referer") || "",
      clientId: body.clientId || clientIdCookie,
      ip: readClientIp(request.headers),
      userAgent: request.headers.get("user-agent") || "",
    });

    return Response.json({ ok: true }, { headers: corsHeaders({ "Cache-Control": "no-store" }) });
  } catch {
    return Response.json({ ok: false }, { status: 500, headers: corsHeaders({ "Cache-Control": "no-store" }) });
  }
}
