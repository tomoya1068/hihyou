"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { getReviewsByUrl, submitReview } from "./actions";

const TAG_OPTIONS = [
  "3P以上",
  "コスプレ",
  "SM",
  "熟女",
  "レイプ",
  "地雷系",
  "巨乳",
  "素人",
  "企画",
  "ハメ撮り",
];

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

function formatNumber(value) {
  if (value === null || Number.isNaN(value)) return "-";
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

export default function ReviewPage() {
  const [url, setUrl] = useState("");
  const [score, setScore] = useState(80);
  const [comment, setComment] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [parsed, setParsed] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({ average: null, median: null, total: 0 });
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  const previewImage = useMemo(() => {
    if (!parsed) return null;
    if (parsed.platform === "fanza") {
      return `https://pics.dmm.co.jp/digital/video/${parsed.productId}/${parsed.productId}pl.jpg`;
    }
    return null;
  }, [parsed]);

  useEffect(() => {
    const nextParsed = parseReviewUrl(url);
    setParsed(nextParsed);

    if (!nextParsed) {
      setReviews([]);
      setSummary({ average: null, median: null, total: 0 });
      return;
    }

    const timer = setTimeout(() => {
      startTransition(async () => {
        const result = await getReviewsByUrl(url);
        setParsed(result.parsed);
        setReviews(result.reviews);
        setSummary(result.summary);
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [url]);

  function toggleTag(tag) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    setStatus("");

    startTransition(async () => {
      const result = await submitReview({
        url,
        score,
        comment,
        tags: selectedTags,
      });

      setStatus(result.message);
      if (!result.ok) return;

      const refreshed = await getReviewsByUrl(url);
      setParsed(refreshed.parsed);
      setReviews(refreshed.reviews);
      setSummary(refreshed.summary);
      setComment("");
    });
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f2f46_0%,_#0a0f1a_35%,_#05070d_100%)] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        <div className="mb-8 rounded-xl border border-amber-400/30 bg-slate-950/70 p-6 shadow-[0_0_35px_rgba(245,158,11,0.12)] backdrop-blur">
          <h1 className="text-3xl font-bold tracking-wide text-amber-300">AV・Fantia批評空間</h1>
          <p className="mt-2 text-sm text-slate-300">URLを貼ると作品IDを自動判定し、同一作品の統計とレビューを表示します。</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <section className="rounded-xl border border-cyan-400/20 bg-slate-900/70 p-6 shadow-[0_0_24px_rgba(34,211,238,0.1)]">
            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label className="mb-1 block text-sm text-slate-300">作品URL</label>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.dmm.co.jp/...?...cid=ssis001"
                  className="w-full rounded-md border border-amber-400/30 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none ring-0 transition focus:border-amber-300"
                  required
                />
                <p className="mt-2 text-xs text-slate-400">
                  判定: {parsed ? `${parsed.platform} / ${parsed.productId}` : "未判定"}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">点数: {score}</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={score}
                  onChange={(e) => setScore(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={score}
                  onChange={(e) => setScore(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                  className="mt-2 w-24 rounded-md border border-amber-400/30 bg-slate-950/70 px-2 py-1 text-sm"
                />
              </div>

              <div>
                <p className="mb-2 text-sm text-slate-300">タグ</p>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {TAG_OPTIONS.map((tag) => (
                    <label key={tag} className="flex cursor-pointer items-center gap-2 rounded border border-slate-700/80 bg-slate-950/60 px-2 py-1 text-sm hover:border-amber-300/50">
                      <input
                        type="checkbox"
                        checked={selectedTags.includes(tag)}
                        onChange={() => toggleTag(tag)}
                        className="accent-amber-400"
                      />
                      <span>{tag}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">感想（任意）</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-cyan-400/20 bg-slate-950/70 px-3 py-2 text-sm outline-none transition focus:border-cyan-300"
                  placeholder="一言レビュー"
                />
              </div>

              <button
                type="submit"
                disabled={isPending || !parsed}
                className="w-full rounded-md border border-amber-300/70 bg-gradient-to-r from-amber-500 to-yellow-300 px-4 py-2 font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? "処理中..." : "批評を投稿する"}
              </button>
              {status && <p className="text-sm text-amber-200">{status}</p>}
            </form>
          </section>

          <aside className="space-y-6">
            <div className="rounded-xl border border-amber-400/30 bg-slate-900/70 p-5">
              <h2 className="mb-3 text-lg font-semibold text-amber-300">統計</h2>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-md border border-slate-700/80 bg-slate-950/70 p-3">
                  <p className="text-xs text-slate-400">平均点</p>
                  <p className="text-xl font-bold text-cyan-300">{formatNumber(summary.average)}</p>
                </div>
                <div className="rounded-md border border-slate-700/80 bg-slate-950/70 p-3">
                  <p className="text-xs text-slate-400">中央値</p>
                  <p className="text-xl font-bold text-cyan-300">{formatNumber(summary.median)}</p>
                </div>
                <div className="rounded-md border border-slate-700/80 bg-slate-950/70 p-3">
                  <p className="text-xs text-slate-400">件数</p>
                  <p className="text-xl font-bold text-cyan-300">{summary.total}</p>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-cyan-400/20 bg-slate-900/70 p-5">
              <h2 className="mb-3 text-lg font-semibold text-cyan-300">プレビュー</h2>
              {previewImage ? (
                <img
                  src={previewImage}
                  alt={parsed?.productId ?? "preview"}
                  className="w-full rounded-md border border-slate-700/70 object-cover"
                />
              ) : (
                <div className="flex h-52 items-center justify-center rounded-md border border-dashed border-slate-600 bg-slate-950/70 text-2xl font-bold tracking-widest text-slate-500">
                  NO IMAGE
                </div>
              )}
            </div>
          </aside>
        </div>

        <section className="mt-8 rounded-xl border border-amber-400/20 bg-slate-900/70 p-6">
          <h2 className="mb-4 text-xl font-semibold text-amber-200">レビュー一覧（新しい順）</h2>
          <div className="space-y-3">
            {reviews.length === 0 && (
              <p className="rounded-md border border-dashed border-slate-700 p-5 text-sm text-slate-400">
                対象作品のレビューはまだありません。
              </p>
            )}
            {reviews.map((review) => (
              <article key={review.id} className="rounded-lg border border-slate-700/80 bg-slate-950/60 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wider text-cyan-300">
                    {review.platform} / {review.product_id}
                  </p>
                  <p className="text-sm text-amber-300">{new Date(review.created_at).toLocaleString()}</p>
                </div>
                <p className="text-2xl font-bold text-amber-200">{review.score} 点</p>
                {review.comment && <p className="mt-2 text-sm text-slate-200">{review.comment}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {(review.tags ?? []).map((tag) => (
                    <span key={`${review.id}-${tag}`} className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
                      #{tag}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}