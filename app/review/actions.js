"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@vercel/postgres";

const fallbackUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!process.env.POSTGRES_URL && fallbackUrl) process.env.POSTGRES_URL = fallbackUrl;
if (!process.env.POSTGRES_URL_NON_POOLING && fallbackUrl) process.env.POSTGRES_URL_NON_POOLING = fallbackUrl;

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
    const url = new URL(text);
    const host = url.hostname.toLowerCase();

    if (host.includes("fantia.jp")) {
      const postMatch = /\/posts\/(\d+)/i.exec(url.pathname);
      if (postMatch?.[1]) return { productId: postMatch[1], platform: "fantia" };
    }

    if (host.includes("dmm.co.jp") || host.includes("fanza")) {
      const cid = url.searchParams.get("cid");
      if (cid && /^[a-z0-9]+$/i.test(cid)) return { productId: cid.toLowerCase(), platform: "fanza" };

      const id = url.searchParams.get("id");
      if (id && /^[a-z0-9]+$/i.test(id)) return { productId: id.toLowerCase(), platform: "fanza" };
    }
  } catch {
    // fallback below
  }

  const cidMatch = /[?&]cid=([a-z0-9]+)/i.exec(text);
  if (cidMatch?.[1]) return { productId: cidMatch[1].toLowerCase(), platform: "fanza" };

  const idMatch = /[?&]id=([a-z0-9]+)/i.exec(text);
  if (idMatch?.[1]) return { productId: idMatch[1].toLowerCase(), platform: "fanza" };

  const fantiaMatch = /posts\/(\d+)/i.exec(text);
  if (fantiaMatch?.[1]) return { productId: fantiaMatch[1], platform: "fantia" };

  return null;
}

function canonicalUrl(platform, productId) {
  if (platform === "fanza") return `https://video.dmm.co.jp/av/content/?id=${productId}`;
  return `https://fantia.jp/posts/${productId}`;
}

function imageUrl(platform, productId) {
  if (platform !== "fanza") return null;
  return `https://pics.dmm.co.jp/digital/video/${productId}/${productId}pl.jpg`;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatDistributionRows(rows) {
  const bins = [
    ["0-9", 0, 9],
    ["10-19", 10, 19],
    ["20-29", 20, 29],
    ["30-39", 30, 39],
    ["40-49", 40, 49],
    ["50-59", 50, 59],
    ["60-69", 60, 69],
    ["70-79", 70, 79],
    ["80-89", 80, 89],
    ["90-100", 90, 100],
  ];

  const map = new Map(rows.map((r) => [r.bucket, Number(r.count ?? 0)]));
  return bins.map(([label, min, max]) => ({
    label,
    min,
    max,
    count: map.get(label) ?? 0,
  }));
}

export async function initDatabase() {
  await sql`
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      product_id VARCHAR(255) NOT NULL,
      platform VARCHAR(50) NOT NULL,
      product_name VARCHAR(255),
      source_url TEXT,
      author VARCHAR(32) DEFAULT 'user',
      score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
      comment TEXT,
      tags TEXT[],
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS product_name VARCHAR(255)`;
  await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS source_url TEXT`;
  await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS author VARCHAR(32) DEFAULT 'user'`;

  const countResult = await sql`SELECT COUNT(*)::int AS count FROM reviews`;
  const count = Number(countResult.rows[0]?.count ?? 0);

  if (count === 0) {
    await sql`
      INSERT INTO reviews (product_id, platform, product_name, source_url, author, score, comment, tags)
      VALUES
      ('ssis001', 'fanza', 'SSIS-001', 'https://video.dmm.co.jp/av/content/?id=ssis001', 'user', 95, '神作。伝説。', ARRAY['コスプレ', '3P以上']),
      ('12345', 'fantia', 'Fantia 12345', 'https://fantia.jp/posts/12345', 'user', 80, '差分が多くて良い', ARRAY['地雷系', 'コスプレ']),
      ('midv002', 'fanza', 'MIDV-002', 'https://video.dmm.co.jp/av/content/?id=midv002', 'user', 15, '期待外れ', ARRAY['熟女']),
      ('ssis001', 'fanza', 'SSIS-001', 'https://video.dmm.co.jp/av/content/?id=ssis001', 'user', 100, '抜ける', ARRAY['SM', 'レイプ'])
    `;
  }
}

export async function getProductPageData(platform, productId) {
  try {
    await initDatabase();

    const summaryResult = await sql`
      SELECT
        COALESCE(MAX(product_name), ${productId}) AS product_name,
        ROUND(AVG(score)::numeric, 2) AS average,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY score) AS median,
        COUNT(*)::int AS total
      FROM reviews
      WHERE product_id = ${productId} AND platform = ${platform}
    `;

    const reviewsResult = await sql`
      SELECT id, product_id, platform, product_name, source_url, author, score, comment, tags, created_at
      FROM reviews
      WHERE product_id = ${productId} AND platform = ${platform}
      ORDER BY created_at DESC, id DESC
    `;

    const distributionResult = await sql`
      SELECT
        CASE
          WHEN score BETWEEN 0 AND 9 THEN '0-9'
          WHEN score BETWEEN 10 AND 19 THEN '10-19'
          WHEN score BETWEEN 20 AND 29 THEN '20-29'
          WHEN score BETWEEN 30 AND 39 THEN '30-39'
          WHEN score BETWEEN 40 AND 49 THEN '40-49'
          WHEN score BETWEEN 50 AND 59 THEN '50-59'
          WHEN score BETWEEN 60 AND 69 THEN '60-69'
          WHEN score BETWEEN 70 AND 79 THEN '70-79'
          WHEN score BETWEEN 80 AND 89 THEN '80-89'
          ELSE '90-100'
        END AS bucket,
        COUNT(*)::int AS count
      FROM reviews
      WHERE product_id = ${productId} AND platform = ${platform}
      GROUP BY bucket
    `;

    const sourceUrls = Array.from(
      new Set(
        reviewsResult.rows
          .map((r) => r.source_url)
          .filter((u) => Boolean(u))
      )
    );

    const summary = summaryResult.rows[0] ?? {};
    return {
      ok: true,
      error: null,
      platform,
      productId,
      productName: summary.product_name ?? productId,
      canonicalUrl: canonicalUrl(platform, productId),
      sourceUrls,
      imageUrl: imageUrl(platform, productId),
      summary: {
        average: toNumberOrNull(summary.average),
        median: toNumberOrNull(summary.median),
        total: Number(summary.total ?? 0),
      },
      distribution: formatDistributionRows(distributionResult.rows),
      reviews: reviewsResult.rows,
    };
  } catch {
    return {
      ok: false,
      error: dbErrorMessage(),
      platform,
      productId,
      productName: productId,
      canonicalUrl: canonicalUrl(platform, productId),
      sourceUrls: [],
      imageUrl: imageUrl(platform, productId),
      summary: { average: null, median: null, total: 0 },
      distribution: formatDistributionRows([]),
      reviews: [],
    };
  }
}

export async function getReviewsByTarget(productId, platform) {
  return getProductPageData(platform, productId);
}

export async function getReviewsByUrl(url) {
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

  const data = await getProductPageData(parsed.platform, parsed.productId);
  return {
    parsed,
    productName: data.productName,
    imageUrl: data.imageUrl,
    reviews: data.reviews,
    summary: data.summary,
    error: data.error,
  };
}

export async function searchProducts(query) {
  try {
    await initDatabase();

    const q = String(query ?? "").trim();
    if (!q) return { query: "", parsed: null, items: [], selected: null, error: null };

    const parsed = parseReviewUrl(q);
    if (parsed) {
      const selected = await getProductPageData(parsed.platform, parsed.productId);
      return { query: q, parsed, items: [], selected, error: selected.error };
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
      SELECT id, product_id, platform, product_name, source_url, author, score, comment, tags, created_at
      FROM reviews
      ORDER BY created_at DESC, id DESC
      LIMIT 14
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
      LIMIT 10
    `;

    return {
      latestReviews: latestResult.rows.map((r) => ({ ...r, imageUrl: imageUrl(r.platform, r.product_id) })),
      hotProducts: productsResult.rows.map((row) => ({
        productId: row.product_id,
        platform: row.platform,
        productName: row.product_name,
        average: toNumberOrNull(row.average),
        median: toNumberOrNull(row.median),
        total: Number(row.total ?? 0),
        imageUrl: imageUrl(row.platform, row.product_id),
      })),
      error: null,
    };
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
    const source = String(input.url ?? "").trim() || canonicalUrl(parsed.platform, parsed.productId);

    await sql`
      INSERT INTO reviews (product_id, platform, product_name, source_url, author, score, comment, tags)
      VALUES (${parsed.productId}, ${parsed.platform}, ${cleanName}, ${source}, 'user', ${score}, ${cleanComment}, ${cleanTags})
    `;

    revalidatePath("/");
    revalidatePath("/search");
    revalidatePath("/review/new");
    revalidatePath(`/title/${parsed.platform}/${parsed.productId}`);

    return { ok: true, message: "投稿しました。", parsed };
  } catch {
    return { ok: false, message: dbErrorMessage(), parsed: null };
  }
}

export async function postRandomBotReview() {
  try {
    await initDatabase();

    const already = await sql`
      SELECT COUNT(*)::int AS count
      FROM reviews
      WHERE author = 'bot'
        AND created_at >= date_trunc('hour', NOW())
    `;
    const count = Number(already.rows[0]?.count ?? 0);
    if (count > 0) {
      return { ok: true, skipped: true, message: "already posted this hour" };
    }

    const fanzaPool = ["ssis001", "midv002", "sora00368", "ipx001", "jul001"];
    const fantiaPool = ["12345", "98765", "774411", "556677"];
    const tagsPool = ["3P以上", "コスプレ", "SM", "熟女", "レイプ", "地雷系", "巨乳", "素人", "企画", "ハメ撮り"];
    const comments = [
      "BOT: 構成が良くて最後まで見やすい。",
      "BOT: 刺さる要素は強いが好みが分かれる。",
      "BOT: 期待値より上。タグ相性が高い。",
      "BOT: 展開は速いが見どころは多い。",
      "BOT: 作風が安定していて再視聴向き。",
    ];

    const platform = Math.random() < 0.5 ? "fanza" : "fantia";
    const productId = platform === "fanza"
      ? fanzaPool[Math.floor(Math.random() * fanzaPool.length)]
      : fantiaPool[Math.floor(Math.random() * fantiaPool.length)];

    const score = Math.floor(Math.random() * 101);
    const comment = comments[Math.floor(Math.random() * comments.length)];
    const shuffled = [...tagsPool].sort(() => Math.random() - 0.5);
    const tags = shuffled.slice(0, 2 + Math.floor(Math.random() * 3));
    const source = canonicalUrl(platform, productId);

    await sql`
      INSERT INTO reviews (product_id, platform, product_name, source_url, author, score, comment, tags)
      VALUES (${productId}, ${platform}, ${platform === "fanza" ? productId.toUpperCase() : `Fantia ${productId}`}, ${source}, 'bot', ${score}, ${comment}, ${tags})
    `;

    revalidatePath("/");
    revalidatePath("/search");
    revalidatePath(`/title/${platform}/${productId}`);

    return { ok: true, skipped: false, platform, productId, score };
  } catch {
    return { ok: false, skipped: false, message: dbErrorMessage() };
  }
}