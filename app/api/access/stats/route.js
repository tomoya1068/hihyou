import { getAccessStats } from "@/lib/access-logs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...extra,
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const hours = Number(url.searchParams.get("hours") ?? 24);
    const recentLimit = Number(url.searchParams.get("recent") ?? 200);
    const stats = await getAccessStats({ hours, recentLimit });

    return Response.json(
      {
        ok: true,
        generatedAt: new Date().toISOString(),
        ...stats,
      },
      { headers: corsHeaders({ "Cache-Control": "no-store" }) },
    );
  } catch {
    return Response.json(
      { ok: false, message: "failed to read access stats" },
      { status: 500, headers: corsHeaders({ "Cache-Control": "no-store" }) },
    );
  }
}
