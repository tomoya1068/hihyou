"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@vercel/postgres";

function parseReviewUrl(url) {
  const fanza = /[?&]cid=([a-z0-9]+)/i.exec(url);
  if (fanza?.[1]) {
    return { productId: fanza[1].toLowerCase(), platform: "fanza" };
  }

  const fantia = /posts\/(\d+)/i.exec(url);
  if (fantia?.[1]) {
    return { productId: fantia[1], platform: "fantia" };
  }

  return null;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export async function initDatabase() {
  await sql`
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      product_id VARCHAR(255) NOT NULL,
      platform VARCHAR(50) NOT NULL,
      score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
      comment TEXT,
      tags TEXT[],
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const countResult = await sql`SELECT COUNT(*)::text AS count FROM reviews`;
  const count = Number(countResult.rows[0]?.count ?? "0");

  if (count === 0) {
    await sql`
      INSERT INTO reviews (product_id, platform, score, comment, tags)
      VALUES
      ('ssis001', 'fanza', 95, '神作。伝説。', ARRAY['コスプレ', '3P以上']),
      ('12345', 'fantia', 80, '差分が多くて良い', ARRAY['地雷系', 'コスプレ']),
      ('midv002', 'fanza', 15, '期待外れ', ARRAY['熟女']),
      ('ssis001', 'fanza', 100, '抜ける', ARRAY['SM', 'レイプ'])
    `;
  }
}

async function getReviewsInternal(productId, platform) {
  await initDatabase();

  const reviewsResult = await sql`
    SELECT id, product_id, platform, score, comment, tags, created_at
    FROM reviews
    WHERE product_id = ${productId} AND platform = ${platform}
    ORDER BY created_at DESC, id DESC
  `;

  const summaryResult = await sql`
    SELECT
      ROUND(AVG(score)::numeric, 2) AS average,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY score) AS median,
      COUNT(*)::int AS total
    FROM reviews
    WHERE product_id = ${productId} AND platform = ${platform}
  `;

  const summaryRow = summaryResult.rows[0];
  return {
    parsed: { productId, platform },
    reviews: reviewsResult.rows,
    summary: {
      average: toNumberOrNull(summaryRow?.average),
      median: toNumberOrNull(summaryRow?.median),
      total: Number(summaryRow?.total ?? 0),
    },
  };
}

export async function getReviewsByUrl(url) {
  const parsed = parseReviewUrl(url);
  if (!parsed) {
    return {
      parsed: null,
      reviews: [],
      summary: { average: null, median: null, total: 0 },
    };
  }
  return getReviewsInternal(parsed.productId, parsed.platform);
}

export async function submitReview(input) {
  const parsed = parseReviewUrl(input.url);

  if (!parsed) {
    return { ok: false, message: "URLから作品IDを抽出できませんでした。", parsed: null };
  }

  await initDatabase();

  const score = Math.max(0, Math.min(100, Math.round(Number(input.score) || 0)));
  const cleanComment = input.comment?.trim() || null;
  const cleanTags = Array.from(new Set((input.tags ?? []).map((t) => t.trim()).filter(Boolean)));

  await sql`
    INSERT INTO reviews (product_id, platform, score, comment, tags)
    VALUES (${parsed.productId}, ${parsed.platform}, ${score}, ${cleanComment}, ${cleanTags})
  `;

  revalidatePath("/review");

  return { ok: true, message: "投稿しました。", parsed };
}