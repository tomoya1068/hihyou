import { createHash } from "crypto";
import { sql } from "@vercel/postgres";

let accessTableReadyPromise;

function hashText(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function normalizePath(rawPath) {
  const text = String(rawPath ?? "").trim();
  if (!text) return "/";
  try {
    const parsed = new URL(text);
    return parsed.pathname + (parsed.search || "");
  } catch {
    if (text.startsWith("/")) return text;
    return `/${text}`;
  }
}

export function readClientIp(headers) {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return headers.get("x-real-ip") || headers.get("cf-connecting-ip") || "";
}

export async function ensureAccessLogTable() {
  if (!accessTableReadyPromise) {
    accessTableReadyPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS access_logs (
          id SERIAL PRIMARY KEY,
          accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          path TEXT NOT NULL,
          referer TEXT,
          client_id VARCHAR(64),
          visitor_hash VARCHAR(64) NOT NULL,
          ip_hash VARCHAR(64) NOT NULL,
          ua_hash VARCHAR(64) NOT NULL
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_access_logs_accessed_at ON access_logs (accessed_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_access_logs_path ON access_logs (path)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_access_logs_visitor_hash ON access_logs (visitor_hash)`;
    })();
  }
  await accessTableReadyPromise;
}

export async function recordAccess({
  path,
  referer,
  clientId,
  ip,
  userAgent,
}) {
  await ensureAccessLogTable();

  const cleanPath = normalizePath(path);
  const cleanReferer = String(referer ?? "").trim() || null;
  const cleanClientId = String(clientId ?? "").trim() || null;
  const ipHash = hashText(String(ip ?? "").trim() || "unknown").slice(0, 32);
  const uaHash = hashText(String(userAgent ?? "").trim() || "unknown").slice(0, 32);
  const visitorHash = hashText(`${cleanClientId || "none"}|${ipHash}|${uaHash}`).slice(0, 32);

  await sql`
    INSERT INTO access_logs (path, referer, client_id, visitor_hash, ip_hash, ua_hash)
    VALUES (${cleanPath}, ${cleanReferer}, ${cleanClientId}, ${visitorHash}, ${ipHash}, ${uaHash})
  `;
}

export async function getAccessStats({ hours = 24, recentLimit = 200 } = {}) {
  await ensureAccessLogTable();

  const normalizedHours = Math.max(1, Math.min(24 * 30, Number(hours) || 24));
  const normalizedRecentLimit = Math.max(1, Math.min(500, Number(recentLimit) || 200));

  const summaryResult = await sql`
    SELECT
      COUNT(*)::int AS total_hits,
      COUNT(DISTINCT visitor_hash)::int AS unique_visitors,
      COUNT(*) FILTER (WHERE accessed_at >= NOW() - INTERVAL '24 hours')::int AS last_24h_hits,
      COUNT(DISTINCT visitor_hash) FILTER (WHERE accessed_at >= NOW() - INTERVAL '24 hours')::int AS last_24h_unique_visitors
    FROM access_logs
  `;

  const hourlyResult = await sql`
    SELECT
      to_char(date_trunc('hour', accessed_at), 'YYYY-MM-DD HH24:00') AS hour,
      COUNT(*)::int AS hits,
      COUNT(DISTINCT visitor_hash)::int AS unique_visitors
    FROM access_logs
    WHERE accessed_at >= NOW() - (${normalizedHours} * INTERVAL '1 hour')
    GROUP BY 1
    ORDER BY 1 DESC
  `;

  const recentResult = await sql`
    SELECT
      accessed_at,
      path,
      referer,
      client_id,
      visitor_hash
    FROM access_logs
    ORDER BY accessed_at DESC
    LIMIT ${normalizedRecentLimit}
  `;

  const summaryRow = summaryResult.rows[0] ?? {};

  return {
    hours: normalizedHours,
    summary: {
      totalHits: Number(summaryRow.total_hits ?? 0),
      uniqueVisitors: Number(summaryRow.unique_visitors ?? 0),
      last24hHits: Number(summaryRow.last_24h_hits ?? 0),
      last24hUniqueVisitors: Number(summaryRow.last_24h_unique_visitors ?? 0),
    },
    hourly: hourlyResult.rows.map((row) => ({
      hour: row.hour,
      hits: Number(row.hits ?? 0),
      uniqueVisitors: Number(row.unique_visitors ?? 0),
    })),
    recent: recentResult.rows.map((row) => ({
      accessedAt: row.accessed_at,
      path: row.path,
      referer: row.referer,
      clientId: row.client_id,
      visitorHash: row.visitor_hash,
    })),
  };
}
