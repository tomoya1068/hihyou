"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@vercel/postgres";

const fallbackUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!process.env.POSTGRES_URL && fallbackUrl) {
  process.env.POSTGRES_URL = fallbackUrl;
}
if (!process.env.POSTGRES_URL_NON_POOLING && fallbackUrl) {
  process.env.POSTGRES_URL_NON_POOLING = fallbackUrl;
}

function dbErrorMessage() {
  const hasAnyUrl = Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);
  if (!hasAnyUrl) {
    return "DB接続情報が未設定です。Vercel Environment Variables に POSTGRES_URL（または DATABASE_URL）を設定してください。";
  }
  return "DB接続に失敗しました。接続文字列またはDB権限を確認してください。";
}

function parseReviewUrl(raw) {
  if (!raw) return null;
  const text = String(raw).trim();

  try {
    const u = new URL(text);
    const hostname = u.hostname.toLowerCase();

    if (hostname.includes("fantia.jp")) {
      const postMatch = /\/posts\/(\d+)/i.exec(u.pathname);
      if (postMatch?.[1]) {
        return { productId: postMatch[1], platform: "fantia" };
      }
    }

    if (hostname.includes("dmm.co.jp") || hostname.includes("fanza")) {
      const cid = u.searchParams.get("cid");
      if (cid && /^[a-z0-9]+$/i.test(cid)) {
        return { productId: cid.toLowerCase(), platform: "fanza" };
      }

      const id = u.searchParams.get("id");
      if (id && /^[a-z0-9]+$/i.test(id)) {
        return { productId: id.toLowerCase(), platform: "fanza" };
      }
    }
  } catch {
    // fallback below for non-URL text
  }

  const cidMatch = /[?&]cid=([a-z0-9]+)/i.exec(text);
  if (cidMatch?.[1]) {
    return { productId: cidMatch[1].toLowerCase(), platform: "fanza" };
  }

  const dmmIdMatch = /[?&]id=([a-z0-9]+)/i.exec(text);
  if (dmmIdMatch?.[1]) {
    return { productId: dmmIdMatch[1].toLowerCase(), platform: "fanza" };
  }

  const fantiaMatch = /posts\/(\d+)/i.exec(text);
  if (fantiaMatch?.[1]) {
    return { productId: fantiaMatch[1], platform: "fantia" };
  }

  return null;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function imageUrl(platform, productId) {
  if (platform !== "fanza") return null;
  return `https://pics.dmm.co.jp/digital/video/${productId}/${productId}pl.jpg`;
}

export async function initDatabase() {
  await sql`
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      product_id VARCHAR(255) NOT NULL,
      platform VARCHAR(50) NOT NULL,
      product_name VARCHAR(255),
      score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
      comment TEXT,
      tags TEXT[],
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS product_name VARCHAR(255)`;

  const countResult = await sql`SELECT COUNT(*)::int AS count FROM reviews`;
  const count = Number(countResult.rows[0]?.count ?? 0);

  if (count === 0) {
    await sql`
      INSERT INTO reviews (product_id, platform, product_name, score, comment, tags)
      VALUES
      ('ssis001', 'fanza', 'SSIS-001', 95, '神作。伝説。', ARRAY['コスプレ', '3P以上']),
      ('12345', 'fantia', 'Fantia 12345', 80, '差分が多くて良い', ARRAY['地雷系', 'コスプレ']),
      ('midv002', 'fanza', 'MIDV-002', 15, '期待外れ', ARRAY['熟女']),
      ('ssis001', 'fanza', 'SSIS-001', 100, '抜ける', ARRAY['SM', 'レイプ'])
    `;
  }
}

export async function getReviewsByTarget(productId, platform) {
  try {
    await initDatabase();

    const reviewsResult = await sql`
      SELECT id, product_id, platform, product_name, score, comment, tags, created_at
      FROM reviews
      WHERE product_id = ${productId} AND platform = ${platform}
      ORDER BY created_at DESC, id DESC
    `;

    const summaryResult = await sql`
      SELECT
        COALESCE(MAX(product_name), ${productId}) AS product_name,
        ROUND(AVG(score)::numeric, 2) AS average,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY score) AS median,
        COUNT(*)::int AS total
      FROM reviews
      WHERE product_id = ${productId} AND platform = ${platform}
    `;

    const summaryRow = summaryResult.rows[0] ?? {};

    return {
      parsed: { productId, platform },
      productName: summaryRow.product_name ?? productId,
      imageUrl: imageUrl(platform, productId),
      reviews: reviewsResult.rows,
      summary: {
        average: toNumberOrNull(summaryRow.average),
        median: toNumberOrNull(summaryRow.median),
        total: Number(summaryRow.total ?? 0),
      },
      error: null,
    };
  } catch {
    return {
      parsed: { productId, platform },
      productName: productId,
      imageUrl: imageUrl(platform, productId),
      reviews: [],
      summary: { average: null, median: null, total: 0 },
      error: dbErrorMessage(),
    };
  }
}

export async function getReviewsByUrl(url) {
  try {
    const parsed = parseReviewUrl(url);
    if (!parsed) {
      return {
        parsed: null,
        productName: null,
        imageUrl: null,
        reviews: [],
        summary: { average: null, median: null, total: 0 },
        error: null,
      };
    }

    return await getReviewsByTarget(parsed.productId, parsed.platform);
  } catch {
    return {
      parsed: null,
      productName: null,
      imageUrl: null,
      reviews: [],
      summary: { average: null, median: null, total: 0 },
      error: "検索に失敗しました。",
    };
  }
}

export async function searchProducts(query) {
  try {
    await initDatabase();

    const q = String(query ?? "").trim();
    if (!q) {
      return { query: "", parsed: null, items: [], selected: null, error: null };
    }

    const parsed = parseReviewUrl(q);
    if (parsed) {
      const selected = await getReviewsByTarget(parsed.productId, parsed.platform);
      return { query: q, parsed, items: [], selected, error: selected.error ?? null };
    }

    const like = `%${q}%`;
    const result = await sql`
      SELECT
        product_id,
        platform,
        COALESCE(MAX(product_name), product_id) AS product_name,
        ROUND(AVG(score)::numeric, 2) AS average,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY score) AS median,
        COUNT(*)::int AS total,
        MAX(created_at) AS last_created_at
      FROM reviews
      WHERE product_id ILIKE ${like}
        OR COALESCE(product_name, '') ILIKE ${like}
        OR comment ILIKE ${like}
        OR EXISTS (
          SELECT 1 FROM unnest(COALESCE(tags, ARRAY[]::text[])) AS t
          WHERE t ILIKE ${like}
        )
      GROUP BY product_id, platform
      ORDER BY total DESC, last_created_at DESC
      LIMIT 24
    `;

    const items = result.rows.map((row) => ({
      productId: row.product_id,
      platform: row.platform,
      productName: row.product_name,
      average: toNumberOrNull(row.average),
      median: toNumberOrNull(row.median),
      total: Number(row.total ?? 0),
      imageUrl: imageUrl(row.platform, row.product_id),
    }));

    return { query: q, parsed: null, items, selected: null, error: null };
  } catch {
    return { query: String(query ?? ""), parsed: null, items: [], selected: null, error: dbErrorMessage() };
  }
}

export async function getHomeData() {
  try {
    await initDatabase();

    const latestResult = await sql`
      SELECT id, product_id, platform, product_name, score, comment, tags, created_at
      FROM reviews
      ORDER BY created_at DESC, id DESC
      LIMIT 12
    `;

    const productsResult = await sql`
      SELECT
        product_id,
        platform,
        COALESCE(MAX(product_name), product_id) AS product_name,
        ROUND(AVG(score)::numeric, 2) AS average,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY score) AS median,
        COUNT(*)::int AS total,
        MAX(created_at) AS last_created_at
      FROM reviews
      GROUP BY product_id, platform
      ORDER BY total DESC, average DESC, last_created_at DESC
      LIMIT 8
    `;

    const latestReviews = latestResult.rows.map((row) => ({
      ...row,
      imageUrl: imageUrl(row.platform, row.product_id),
    }));

    const hotProducts = productsResult.rows.map((row) => ({
      productId: row.product_id,
      platform: row.platform,
      productName: row.product_name,
      average: toNumberOrNull(row.average),
      median: toNumberOrNull(row.median),
      total: Number(row.total ?? 0),
      imageUrl: imageUrl(row.platform, row.product_id),
    }));

    return { latestReviews, hotProducts, error: null };
  } catch {
    return { latestReviews: [], hotProducts: [], error: dbErrorMessage() };
  }
}

export async function submitReview(input) {
  try {
    const parsed = parseReviewUrl(input.url);

    if (!parsed) {
      return { ok: false, message: "URLから作品IDを抽出できませんでした。", parsed: null };
    }

    await initDatabase();

    const score = Math.max(0, Math.min(100, Math.round(Number(input.score) || 0)));
    const cleanName = input.productName?.trim() || null;
    const cleanComment = input.comment?.trim() || null;
    const cleanTags = Array.from(new Set((input.tags ?? []).map((t) => t.trim()).filter(Boolean)));

    await sql`
      INSERT INTO reviews (product_id, platform, product_name, score, comment, tags)
      VALUES (${parsed.productId}, ${parsed.platform}, ${cleanName}, ${score}, ${cleanComment}, ${cleanTags})
    `;

    revalidatePath("/");
    revalidatePath("/search");
    revalidatePath("/review");
    revalidatePath("/review/new");

    return { ok: true, message: "投稿しました。", parsed };
  } catch {
    return {
      ok: false,
      message: dbErrorMessage(),
      parsed: null,
    };
  }
}
