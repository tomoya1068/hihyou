"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@vercel/postgres";
import { createHash } from "crypto";

const fallbackUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!process.env.POSTGRES_URL && fallbackUrl) process.env.POSTGRES_URL = fallbackUrl;
if (!process.env.POSTGRES_URL_NON_POOLING && fallbackUrl) process.env.POSTGRES_URL_NON_POOLING = fallbackUrl;

const TAG_OPTIONS = ["3P以上", "コスプレ", "SM", "熟女", "レイプ", "地雷系", "巨乳", "素人", "企画", "ハメ撮り", "人妻"];

function dbErrorMessage() {
  const hasAnyUrl = Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);
  if (!hasAnyUrl) return "DB connection settings are missing. Set POSTGRES_URL or DATABASE_URL.";
  return "DB connection failed. Check URL and DB permissions.";
}

function externalProductIdFromUrl(rawUrl) {
  const normalized = String(rawUrl ?? "").trim();
  const hash = createHash("sha1").update(normalized).digest("hex").slice(0, 16);
  return `ext_${hash}`;
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
      const productMatch = /\/products\/(\d+)/i.exec(url.pathname);
      if (productMatch?.[1]) return { productId: productMatch[1], platform: "fantia" };
      const itemId = url.searchParams.get("item_id");
      if (itemId && /^\d+$/.test(itemId)) return { productId: itemId, platform: "fantia" };
    }

    if (host.includes("dmm.co.jp") || host.includes("fanza")) {
      const cid = url.searchParams.get("cid");
      if (cid && /^[a-z0-9]+$/i.test(cid)) return { productId: cid.toLowerCase(), platform: "fanza" };

      const id = url.searchParams.get("id");
      if (id && /^[a-z0-9]+$/i.test(id)) return { productId: id.toLowerCase(), platform: "fanza" };
    }

    if (url.protocol === "http:" || url.protocol === "https:") {
      return { productId: externalProductIdFromUrl(url.toString()), platform: "external" };
    }
  } catch {
    // fallback below
  }

  const cidMatch = /[?&]cid=([a-z0-9]+)/i.exec(text);
  if (cidMatch?.[1]) return { productId: cidMatch[1].toLowerCase(), platform: "fanza" };

  const idMatch = /[?&]id=([a-z0-9]+)/i.exec(text);
  if (idMatch?.[1]) return { productId: idMatch[1].toLowerCase(), platform: "fanza" };

  const fantiaMatch = /(?:posts|products)\/(\d+)/i.exec(text);
  if (fantiaMatch?.[1]) return { productId: fantiaMatch[1], platform: "fantia" };
  const fantiaItemId = /[?&]item_id=(\d+)/i.exec(text);
  if (fantiaItemId?.[1]) return { productId: fantiaItemId[1], platform: "fantia" };

  return null;
}

function canonicalUrl(platform, productId) {
  if (platform === "fanza") {
    return `https://video.dmm.co.jp/av/content/?id=${productId}`;
  }
  if (platform === "fantia") {
    return `https://fantia.jp/posts/${productId}`;
  }
  return "";
}

function metadataCandidateUrls(platform, productId, sourceUrls = []) {
  const urls = normalizeList(sourceUrls.filter(Boolean), 20);
  if (platform === "fanza") {
    urls.push(`https://video.dmm.co.jp/av/content/?id=${productId}`);
    urls.push(`https://www.dmm.co.jp/digital/videoa/-/detail/=/cid=${productId}/`);
  }
  const canonical = canonicalUrl(platform, productId);
  if (canonical) urls.push(canonical);
  return normalizeList(urls, 24);
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
  const bins = ["0-9", "10-19", "20-29", "30-39", "40-49", "50-59", "60-69", "70-79", "80-89", "90-100"];
  const map = new Map(rows.map((r) => [r.bucket, Number(r.count ?? 0)]));
  return bins.map((label) => ({ label, count: map.get(label) ?? 0 }));
}

function normalizeList(values, max = 12) {
  const out = [];
  const seen = new Set();
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (!s) continue;
    if (s.length > 160) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function isAgeGateTitle(title) {
  const t = String(title ?? "").trim();
  if (!t) return false;
  return (
    /\u5e74\u9f62\u8a8d\u8a3c/i.test(t) ||
    /age\s*verification/i.test(t) ||
    /18\+/.test(t) ||
    (/fanza/i.test(t) && /verify|\u8a8d\u8a3c|\u5e74\u9f62/i.test(t))
  );
}

function shouldRefreshTitle(currentTitle, productId) {
  const t = String(currentTitle ?? "").trim();
  if (!t) return true;
  if (t.toLowerCase() === String(productId ?? "").trim().toLowerCase()) return true;
  if (/^[a-z0-9-]+$/i.test(t)) return true;
  if (isAgeGateTitle(t)) return true;
  return false;
}

function titleLooksLikeProductCode(title, productId) {
  const t = String(title ?? "").trim();
  if (!t) return false;
  const pid = String(productId ?? "").trim();
  const normalize = (v) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalize(t) === normalize(pid)) return true;
  if (/^[a-z]{2,8}-?\d{2,6}$/i.test(t)) return true;
  if (/^[a-z0-9-]{4,24}$/i.test(t)) return true;
  return false;
}

function extractTitleFromHtml(html) {
  const og = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i.exec(html)?.[1];
  if (og) return og.trim();

  const tw = /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["'][^>]*>/i.exec(html)?.[1];
  if (tw) return tw.trim();

  const t = /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1];
  if (t) return t.trim();

  return null;
}

function extractNamesFromJsonLd(html) {
  const out = [];
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];
  for (const b of blocks) {
    const jsonText = b.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try {
      const parsed = JSON.parse(jsonText);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of list) {
        const actor = item?.actor;
        if (Array.isArray(actor)) actor.forEach((a) => out.push(a?.name || a));
        else if (actor) out.push(actor?.name || actor);

        const performer = item?.performer;
        if (Array.isArray(performer)) performer.forEach((p) => out.push(p?.name || p));
        else if (performer) out.push(performer?.name || performer);
      }
    } catch {
      // ignore malformed block
    }
  }
  return normalizeList(out);
}

async function fetchPageMetadata(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; ReviewNexusBot/1.0)",
        // FANZA age-gate bypass hint; without this, title can become "年齢認証 - FANZA".
        cookie: "age_check_done=1; ckcy=1",
        referer: "https://www.dmm.co.jp/",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return { title: null, actressNames: [] };

    const html = await res.text();
    let title = extractTitleFromHtml(html);
    if (title && /年齢認証\s*-\s*FANZA/i.test(title)) {
      title = null;
    }
    if (isAgeGateTitle(title)) title = null;
    const actressNames = extractNamesFromJsonLd(html);
    return { title, actressNames, html };
  } catch {
    return { title: null, actressNames: [], html: "" };
  }
}

async function resolveProductMetadata(platform, productId, sourceCandidates) {
  const candidates = normalizeList(sourceCandidates.filter(Boolean), 4);
  const metas = await Promise.all(candidates.map((src) => fetchPageMetadata(src)));

  let fallback = { title: null, actressNames: [], html: "" };
  for (const meta of metas) {
    const hasData = Boolean(meta.title) || meta.actressNames.length > 0;
    if (hasData && !fallback.title && fallback.actressNames.length === 0) fallback = meta;
    if (meta.title && !isAgeGateTitle(meta.title) && !titleLooksLikeProductCode(meta.title, productId)) return meta;
  }
  return fallback;
}

function parseFanzaLinks(html) {
  const links = [];
  const pattern = /<a[^>]+href=["']([^"']*\/av\/content\/\?id=([a-z0-9]+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = pattern.exec(html)) !== null) {
    const href = m[1];
    const productId = m[2]?.toLowerCase();
    const text = m[3]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!productId) continue;
    links.push({
      productId,
      sourceUrl: href.startsWith("http") ? href : `https://video.dmm.co.jp${href}`,
      title: text || null,
    });
    if (links.length >= 30) break;
  }
  return links;
}

export async function initDatabase() {
  await sql`
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      product_id VARCHAR(255) NOT NULL,
      platform VARCHAR(50) NOT NULL,
      product_name VARCHAR(255),
      source_url TEXT,
      cosplay_character VARCHAR(255),
      performer_names TEXT[],
      actress_names TEXT[],
      author VARCHAR(32) DEFAULT 'user',
      score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
      comment TEXT,
      tags TEXT[],
      likes_count INTEGER NOT NULL DEFAULT 0,
      helpful_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS product_notes (
      product_id VARCHAR(255) NOT NULL,
      platform VARCHAR(50) NOT NULL,
      overall_comment TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (product_id, platform)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS fanza_releases (
      product_id VARCHAR(255) PRIMARY KEY,
      title TEXT,
      source_url TEXT,
      image_url TEXT,
      fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS product_name VARCHAR(255)`;
  await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS source_url TEXT`;
  await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS cosplay_character VARCHAR(255)`;
  await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS performer_names TEXT[]`;
  await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS actress_names TEXT[]`;
  await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS author VARCHAR(32) DEFAULT 'user'`;
  await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS helpful_count INTEGER NOT NULL DEFAULT 0`;

  const countResult = await sql`SELECT COUNT(*)::int AS count FROM reviews`;
  const count = Number(countResult.rows[0]?.count ?? 0);
  if (count === 0) {
    await sql`
      INSERT INTO reviews (product_id, platform, product_name, source_url, actress_names, author, score, comment, tags)
      VALUES
      ('ssis001', 'fanza', 'SSIS-001', 'https://video.dmm.co.jp/av/content/?id=ssis001', ARRAY[]::text[], 'user', 95, '神作。伝説。', ARRAY['コスプレ', '3P以上']),
      ('12345', 'fantia', 'Fantia 12345', 'https://fantia.jp/posts/12345', ARRAY[]::text[], 'user', 80, '差分が多くて良い', ARRAY['地雷系', 'コスプレ']),
      ('midv002', 'fanza', 'MIDV-002', 'https://video.dmm.co.jp/av/content/?id=midv002', ARRAY[]::text[], 'user', 15, '期待外れ', ARRAY['熟女']),
      ('ssis001', 'fanza', 'SSIS-001', 'https://video.dmm.co.jp/av/content/?id=ssis001', ARRAY[]::text[], 'user', 100, '抜ける', ARRAY['SM', 'レイプ'])
    `;
  }
}

export async function reactToReview(input) {
  try {
    await initDatabase();
    const id = Number(input?.reviewId);
    const reaction = String(input?.reaction ?? "");
    if (!Number.isInteger(id) || id <= 0) return { ok: false, message: "invalid review id" };

    if (reaction === "like") {
      await sql`UPDATE reviews SET likes_count = likes_count + 1 WHERE id = ${id}`;
    } else if (reaction === "helpful") {
      await sql`UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = ${id}`;
    } else {
      return { ok: false, message: "invalid reaction type" };
    }

    return { ok: true };
  } catch {
    return { ok: false, message: dbErrorMessage() };
  }
}

export async function saveOverallComment(input) {
  try {
    await initDatabase();
    const productId = String(input.productId ?? "").trim().toLowerCase();
    const platform = String(input.platform ?? "").trim().toLowerCase();
    const overallComment = String(input.comment ?? "").trim();

    if (!productId || !(platform === "fanza" || platform === "fantia")) {
      return { ok: false, message: "Invalid product target." };
    }

    await sql`
      INSERT INTO product_notes (product_id, platform, overall_comment, updated_at)
      VALUES (${productId}, ${platform}, ${overallComment || null}, NOW())
      ON CONFLICT (product_id, platform)
      DO UPDATE SET overall_comment = EXCLUDED.overall_comment, updated_at = NOW()
    `;

    revalidatePath(`/title/${platform}/${productId}`);
    return { ok: true, message: "Saved." };
  } catch {
    return { ok: false, message: dbErrorMessage() };
  }
}

export async function syncFanzaNewReleases() {
  try {
    await initDatabase();

    const listingSources = [
      "https://www.dmm.co.jp/digital/videoa/-/list/=/sort=release/",
      "https://www.dmm.co.jp/digital/videoa/-/list/=/sort=ranking/",
    ];

    const collected = [];
    for (const url of listingSources) {
      const page = await fetchPageMetadata(url);
      if (!page.html) continue;
      const links = parseFanzaLinks(page.html);
      collected.push(...links);
    }

    const dedupMap = new Map();
    for (const item of collected) {
      if (!dedupMap.has(item.productId)) dedupMap.set(item.productId, item);
      if (dedupMap.size >= 20) break;
    }

    for (const item of dedupMap.values()) {
      const fallbackSource = item.sourceUrl || canonicalUrl("fanza", item.productId);
      let title = item.title;
      if (!title || /^[a-z0-9-]+$/i.test(title)) {
        const meta = await fetchPageMetadata(fallbackSource);
        title = meta.title || item.productId;
      }

      await sql`
        INSERT INTO fanza_releases (product_id, title, source_url, image_url, fetched_at)
        VALUES (${item.productId}, ${title}, ${fallbackSource}, ${imageUrl("fanza", item.productId)}, NOW())
        ON CONFLICT (product_id)
        DO UPDATE SET
          title = EXCLUDED.title,
          source_url = EXCLUDED.source_url,
          image_url = EXCLUDED.image_url,
          fetched_at = NOW()
      `;
    }

    revalidatePath("/");
    return { ok: true, count: dedupMap.size };
  } catch {
    return { ok: false, message: dbErrorMessage() };
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
      SELECT id, product_id, platform, product_name, source_url, cosplay_character, performer_names, actress_names, author, score, comment, tags, likes_count, helpful_count, created_at
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

    const noteResult = await sql`
      SELECT overall_comment
      FROM product_notes
      WHERE product_id = ${productId} AND platform = ${platform}
      LIMIT 1
    `;

    const sourceUrls = normalizeList(reviewsResult.rows.map((r) => r.source_url).filter(Boolean), 20);

    const summary = summaryResult.rows[0] ?? {};
    let productName = String(summary.product_name ?? productId);
    let actressNames = normalizeList(reviewsResult.rows.flatMap((r) => (Array.isArray(r.actress_names) ? r.actress_names : [])), 12);

    const shouldAttemptMetadataFetch =
      shouldRefreshTitle(productName, productId) &&
      platform !== "external" &&
      !(platform === "fantia" && /^\d+$/.test(productId));

    if (shouldAttemptMetadataFetch) {
      const meta = await resolveProductMetadata(platform, productId, metadataCandidateUrls(platform, productId, sourceUrls));
      if (meta.title) {
        productName = meta.title;
        await sql`
          UPDATE reviews
          SET product_name = ${productName}
          WHERE product_id = ${productId} AND platform = ${platform}
            AND (
              product_name IS NULL
              OR trim(product_name) = ''
              OR lower(product_name) = lower(${productId})
              OR product_name ~* '^[a-z0-9-]+$'
              OR product_name ILIKE '%FANZA%'
              OR product_name ILIKE '%age verification%'
            )
        `;
      }
      if (actressNames.length === 0 && meta.actressNames.length > 0) {
        actressNames = meta.actressNames;
        await sql`
          UPDATE reviews
          SET actress_names = ${actressNames}
          WHERE product_id = ${productId} AND platform = ${platform}
            AND (actress_names IS NULL OR array_length(actress_names, 1) IS NULL)
        `;
      }
    }

    const canonical = canonicalUrl(platform, productId) || sourceUrls[0] || "";

    return {
      ok: true,
      error: null,
      platform,
      productId,
      productName,
      canonicalUrl: canonical,
      sourceUrls,
      actressNames,
      overallComment: noteResult.rows[0]?.overall_comment ?? "",
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
      canonicalUrl: canonicalUrl(platform, productId) || "",
      sourceUrls: [],
      actressNames: [],
      overallComment: "",
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
    return { parsed: null, productName: null, imageUrl: null, reviews: [], summary: { average: null, median: null, total: 0 }, error: null };
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

export async function searchProducts(query, tagFilters = [], characterQuery = "") {
  try {
    await initDatabase();

    const q = String(query ?? "").trim();
    const filters = Array.isArray(tagFilters) ? tagFilters.filter(Boolean) : [];
    const character = String(characterQuery ?? "").trim();
    const characterLike = `%${character}%`;

    if (!q) {
      const base = character
        ? await sql`
            SELECT
              product_id,
              platform,
              COALESCE(MAX(product_name), product_id) AS product_name,
              ROUND(AVG(score)::numeric, 2) AS average,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY score) AS median,
              COUNT(*)::int AS total,
              COALESCE(array_agg(DISTINCT t.tag) FILTER (WHERE t.tag IS NOT NULL), ARRAY[]::text[]) AS all_tags,
              COALESCE(array_agg(DISTINCT r.cosplay_character) FILTER (WHERE r.cosplay_character IS NOT NULL AND trim(r.cosplay_character) <> ''), ARRAY[]::text[]) AS all_characters,
              MAX(created_at) AS last_created_at
            FROM reviews r
            LEFT JOIN LATERAL unnest(COALESCE(r.tags, ARRAY[]::text[])) AS t(tag) ON TRUE
            WHERE COALESCE(r.cosplay_character, '') ILIKE ${characterLike}
            GROUP BY product_id, platform
            ORDER BY last_created_at DESC
            LIMIT 30
          `
        : await sql`
            SELECT
              product_id,
              platform,
              COALESCE(MAX(product_name), product_id) AS product_name,
              ROUND(AVG(score)::numeric, 2) AS average,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY score) AS median,
              COUNT(*)::int AS total,
              COALESCE(array_agg(DISTINCT t.tag) FILTER (WHERE t.tag IS NOT NULL), ARRAY[]::text[]) AS all_tags,
              COALESCE(array_agg(DISTINCT r.cosplay_character) FILTER (WHERE r.cosplay_character IS NOT NULL AND trim(r.cosplay_character) <> ''), ARRAY[]::text[]) AS all_characters,
              MAX(created_at) AS last_created_at
            FROM reviews r
            LEFT JOIN LATERAL unnest(COALESCE(r.tags, ARRAY[]::text[])) AS t(tag) ON TRUE
            GROUP BY product_id, platform
            ORDER BY last_created_at DESC
            LIMIT 30
          `;

      let items = base.rows.map((row) => ({
        productId: row.product_id,
        platform: row.platform,
        productName: row.product_name,
        average: toNumberOrNull(row.average),
        median: toNumberOrNull(row.median),
        total: Number(row.total ?? 0),
        imageUrl: imageUrl(row.platform, row.product_id),
        tags: row.all_tags ?? [],
        characters: row.all_characters ?? [],
      }));

      if (filters.length > 0) {
        items = items.filter((item) => filters.every((f) => item.tags.includes(f)));
      }

      return { query: q, parsed: null, items, selected: null, error: null };
    }

    const parsed = parseReviewUrl(q);
    if (parsed) {
      const selected = await getProductPageData(parsed.platform, parsed.productId);
      return { query: q, parsed, items: [], selected, error: selected.error };
    }

    const like = `%${q}%`;
    const result = character
      ? await sql`
          SELECT
            product_id,
            platform,
            COALESCE(MAX(product_name), product_id) AS product_name,
            ROUND(AVG(score)::numeric, 2) AS average,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY score) AS median,
            COUNT(*)::int AS total,
            COALESCE(array_agg(DISTINCT t.tag) FILTER (WHERE t.tag IS NOT NULL), ARRAY[]::text[]) AS all_tags,
            COALESCE(array_agg(DISTINCT r.cosplay_character) FILTER (WHERE r.cosplay_character IS NOT NULL AND trim(r.cosplay_character) <> ''), ARRAY[]::text[]) AS all_characters,
            MAX(created_at) AS last_created_at
          FROM reviews r
          LEFT JOIN LATERAL unnest(COALESCE(r.tags, ARRAY[]::text[])) AS t(tag) ON TRUE
          WHERE (
            product_id ILIKE ${like}
            OR COALESCE(product_name, '') ILIKE ${like}
            OR comment ILIKE ${like}
            OR COALESCE(cosplay_character, '') ILIKE ${like}
            OR EXISTS (
              SELECT 1 FROM unnest(COALESCE(tags, ARRAY[]::text[])) AS tag
              WHERE tag ILIKE ${like}
            )
          )
            AND COALESCE(cosplay_character, '') ILIKE ${characterLike}
          GROUP BY product_id, platform
          ORDER BY total DESC, last_created_at DESC
          LIMIT 40
        `
      : await sql`
          SELECT
            product_id,
            platform,
            COALESCE(MAX(product_name), product_id) AS product_name,
            ROUND(AVG(score)::numeric, 2) AS average,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY score) AS median,
            COUNT(*)::int AS total,
            COALESCE(array_agg(DISTINCT t.tag) FILTER (WHERE t.tag IS NOT NULL), ARRAY[]::text[]) AS all_tags,
            COALESCE(array_agg(DISTINCT r.cosplay_character) FILTER (WHERE r.cosplay_character IS NOT NULL AND trim(r.cosplay_character) <> ''), ARRAY[]::text[]) AS all_characters,
            MAX(created_at) AS last_created_at
          FROM reviews r
          LEFT JOIN LATERAL unnest(COALESCE(r.tags, ARRAY[]::text[])) AS t(tag) ON TRUE
          WHERE product_id ILIKE ${like}
            OR COALESCE(product_name, '') ILIKE ${like}
            OR comment ILIKE ${like}
            OR COALESCE(cosplay_character, '') ILIKE ${like}
            OR EXISTS (
              SELECT 1 FROM unnest(COALESCE(tags, ARRAY[]::text[])) AS tag
              WHERE tag ILIKE ${like}
            )
          GROUP BY product_id, platform
          ORDER BY total DESC, last_created_at DESC
          LIMIT 40
        `;

    let items = result.rows.map((row) => ({
      productId: row.product_id,
      platform: row.platform,
      productName: row.product_name,
      average: toNumberOrNull(row.average),
      median: toNumberOrNull(row.median),
      total: Number(row.total ?? 0),
      imageUrl: imageUrl(row.platform, row.product_id),
      tags: row.all_tags ?? [],
      characters: row.all_characters ?? [],
    }));

    if (filters.length > 0) {
      items = items.filter((item) => filters.every((f) => item.tags.includes(f)));
    }

    return { query: q, parsed: null, items, selected: null, error: null };
  } catch {
    return { query: String(query ?? ""), parsed: null, items: [], selected: null, error: dbErrorMessage() };
  }
}

export async function getHomeData() {
  try {
    await initDatabase();

    const latestResult = await sql`
      SELECT id, product_id, platform, product_name, source_url, cosplay_character, performer_names, author, score, comment, tags, likes_count, helpful_count, created_at
      FROM reviews
      ORDER BY created_at DESC, id DESC
      LIMIT 14
    `;

    const releasesResult = await sql`
      SELECT product_id, title, source_url, image_url, fetched_at
      FROM fanza_releases
      ORDER BY fetched_at DESC
      LIMIT 18
    `;

    return {
      latestReviews: latestResult.rows.map((r) => ({ ...r, imageUrl: imageUrl(r.platform, r.product_id) })),
      newReleases: releasesResult.rows.map((r) => ({
        productId: r.product_id,
        title: r.title || r.product_id,
        sourceUrl: r.source_url || canonicalUrl("fanza", r.product_id),
        imageUrl: r.image_url || imageUrl("fanza", r.product_id),
        fetchedAt: r.fetched_at,
      })),
      error: null,
    };
  } catch {
    return { latestReviews: [], newReleases: [], error: dbErrorMessage() };
  }
}

export async function submitReview(input) {
  try {
    const cleanName = input.productName?.trim() || null;
    const parsed = parseReviewUrl(input.url);
    if (!parsed) return { ok: false, message: "Could not parse product from URL.", parsed: null };
    if (parsed.platform === "external" && !cleanName) {
      return { ok: false, message: "FANZA/Fantia 以外のURLは作品名（タイトル）が必須です。", parsed: null };
    }

    await initDatabase();

    const score = Math.max(0, Math.min(100, Math.round(Number(input.score) || 0)));
    const cleanComment = input.comment?.trim() || null;
    const cleanTags = Array.from(new Set((input.tags ?? []).map((t) => t.trim()).filter(Boolean))).slice(0, 1);
    const performerNames = Array.from(
      new Set(
        String(input.performerNames ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 8),
      ),
    );
    const cosplayCharacterRaw = String(input.cosplayCharacter ?? "").trim();
    const cosplayCharacter = cleanTags[0] === TAG_OPTIONS[1] && cosplayCharacterRaw ? cosplayCharacterRaw.slice(0, 255) : null;
    const source = String(input.url ?? "").trim() || canonicalUrl(parsed.platform, parsed.productId);

    const meta =
      parsed.platform === "external" || cleanName
        ? { title: null, actressNames: [] }
        : await resolveProductMetadata(parsed.platform, parsed.productId, metadataCandidateUrls(parsed.platform, parsed.productId, [source]));
    const productName = cleanName || meta.title || parsed.productId;
    const actressNames = meta.actressNames ?? [];

    await sql`
      INSERT INTO reviews (product_id, platform, product_name, source_url, cosplay_character, performer_names, actress_names, author, score, comment, tags)
      VALUES (${parsed.productId}, ${parsed.platform}, ${productName}, ${source}, ${cosplayCharacter}, ${performerNames}, ${actressNames}, 'user', ${score}, ${cleanComment}, ${cleanTags})
    `;

    revalidatePath("/");
    revalidatePath("/search");
    revalidatePath("/review/new");
    revalidatePath(`/title/${parsed.platform}/${parsed.productId}`);

    return { ok: true, message: "Posted.", parsed };
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
    if (Number(already.rows[0]?.count ?? 0) > 0) {
      return { ok: true, skipped: true, message: "already posted this hour" };
    }

    const candidates = [
      { platform: "fanza", productId: "ssis001" },
      { platform: "fanza", productId: "midv002" },
      { platform: "fanza", productId: "sora00368" },
      { platform: "fanza", productId: "ipx001" },
      { platform: "fanza", productId: "jul001" },
      { platform: "fantia", productId: "12345" },
      { platform: "fantia", productId: "98765" },
      { platform: "fantia", productId: "774411" },
      { platform: "fantia", productId: "556677" },
    ];

    const available = [];
    for (const c of candidates) {
      const hasComment = await sql`
        SELECT COUNT(*)::int AS count
        FROM reviews
        WHERE product_id = ${c.productId}
          AND platform = ${c.platform}
          AND comment IS NOT NULL
          AND length(trim(comment)) > 0
      `;
      if (Number(hasComment.rows[0]?.count ?? 0) === 0) available.push(c);
    }

    if (available.length === 0) {
      return { ok: true, skipped: true, message: "all candidate titles already have comments" };
    }

    const picked = available[Math.floor(Math.random() * available.length)];
    const tagsPool = TAG_OPTIONS;
    const comments = [
      "BOT: fast pacing and clear concept.",
      "BOT: polarizing, but has strong hooks.",
      "BOT: well-balanced structure overall.",
      "BOT: consistent direction and tone.",
      "BOT: easy to follow for first viewers.",
    ];

    const source = canonicalUrl(picked.platform, picked.productId);
    const meta = await resolveProductMetadata(picked.platform, picked.productId, metadataCandidateUrls(picked.platform, picked.productId, [source]));

    const score = Math.floor(Math.random() * 101);
    const comment = comments[Math.floor(Math.random() * comments.length)];
    const tags = [...tagsPool].sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 3));

    await sql`
      INSERT INTO reviews (product_id, platform, product_name, source_url, cosplay_character, performer_names, actress_names, author, score, comment, tags)
      VALUES (
        ${picked.productId},
        ${picked.platform},
        ${meta.title || picked.productId.toUpperCase()},
        ${source},
        NULL,
        ARRAY[]::text[],
        ${meta.actressNames || []},
        'bot',
        ${score},
        ${comment},
        ${tags}
      )
    `;

    revalidatePath("/");
    revalidatePath("/search");
    revalidatePath(`/title/${picked.platform}/${picked.productId}`);

    return { ok: true, skipped: false, platform: picked.platform, productId: picked.productId, score };
  } catch {
    return { ok: false, skipped: false, message: dbErrorMessage() };
  }
}
