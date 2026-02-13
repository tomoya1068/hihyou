"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getProductPageData, reactToReview, saveOverallComment } from "@/app/review/actions";

function formatNumber(value) {
  if (value === null || Number.isNaN(value)) return "-";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export default function TitleDetailPage() {
  const params = useParams();
  const platform = String(params?.platform ?? "").toLowerCase();
  const productId = String(params?.productId ?? "").toLowerCase();

  const [data, setData] = useState(null);
  const [overallComment, setOverallComment] = useState("");
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!platform || !productId) return;
    startTransition(async () => {
      const result = await getProductPageData(platform, productId);
      setData(result);
      setOverallComment(result.overallComment || "");
    });
  }, [platform, productId]);

  const maxCount = useMemo(() => {
    if (!data?.distribution?.length) return 1;
    return Math.max(1, ...data.distribution.map((d) => d.count));
  }, [data]);

  async function onSaveOverallComment(e) {
    e.preventDefault();
    setStatus("");

    startTransition(async () => {
      const result = await saveOverallComment({ platform, productId, comment: overallComment });
      setStatus(result.message);
      if (!result.ok) return;
      const refreshed = await getProductPageData(platform, productId);
      setData(refreshed);
      setOverallComment(refreshed.overallComment || "");
    });
  }

  async function onReact(reviewId, reaction) {
    const result = await reactToReview({ reviewId, reaction });
    if (!result.ok) return;

    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        reviews: prev.reviews.map((r) => {
          if (r.id !== reviewId) return r;
          if (reaction === "like") return { ...r, likes_count: Number(r.likes_count || 0) + 1 };
          return { ...r, helpful_count: Number(r.helpful_count || 0) + 1 };
        }),
      };
    });
  }

  if (!platform || !productId) return <div className="panel p-6 text-sm text-rose-300">invalid product params.</div>;
  if (isPending && !data) return <div className="panel p-6 text-sm text-slate-300">loading...</div>;
  if (!data) return <div className="panel p-6 text-sm text-rose-300">failed to load.</div>;

  return (
    <div className="space-y-6">
      <section className="panel-gold p-6">
        <p className="text-xs uppercase tracking-wider text-cyan-300">{data.platform} / {data.productId}</p>
        <h1 className="mt-1 text-3xl font-bold text-amber-200">{data.productName || data.productId}</h1>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
          <div className="rounded-md border border-slate-700/80 bg-slate-950/60 p-3"><p className="text-slate-500">平均点</p><p className="text-xl font-semibold text-amber-200">{formatNumber(data.summary.average)}</p></div>
          <div className="rounded-md border border-slate-700/80 bg-slate-950/60 p-3"><p className="text-slate-500">中央値</p><p className="text-xl font-semibold text-amber-200">{formatNumber(data.summary.median)}</p></div>
          <div className="rounded-md border border-slate-700/80 bg-slate-950/60 p-3"><p className="text-slate-500">レビュー数</p><p className="text-xl font-semibold text-amber-200">{data.summary.total}</p></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={data.canonicalUrl} target="_blank" rel="noreferrer" className="btn-cyan">元サイト</a>
          <Link href="/review/new" className="btn-gold">この作品に投稿</Link>
        </div>
      </section>

      {data.error && <p className="panel p-4 text-sm text-rose-300">{data.error}</p>}

      <section className="panel p-6">
        <h2 className="mb-4 text-xl font-semibold text-cyan-200">女優・出演者</h2>
        {data.actressNames.length === 0 && <p className="text-sm text-slate-400">出演者情報なし</p>}
        <div className="flex flex-wrap gap-2">
          {data.actressNames.map((name) => (
            <span key={name} className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-200">{name}</span>
          ))}
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="mb-4 text-xl font-semibold text-cyan-200">点数分布</h2>
        <div className="space-y-2">
          {data.distribution.map((d) => (
            <div key={d.label} className="grid grid-cols-[70px_1fr_40px] items-center gap-3 text-sm">
              <span className="text-slate-300">{d.label}</span>
              <div className="h-3 overflow-hidden rounded bg-slate-800">
                <div className="h-full rounded bg-gradient-to-r from-cyan-500 to-amber-400" style={{ width: `${(d.count / maxCount) * 100}%` }} />
              </div>
              <span className="text-right text-slate-300">{d.count}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="mb-3 text-lg font-semibold text-amber-200">URL reverse links</h2>
        <div className="space-y-2 break-all text-sm">
          <p><a className="text-cyan-200 underline" target="_blank" rel="noreferrer" href={data.canonicalUrl}>{data.canonicalUrl}</a></p>
          {data.sourceUrls.map((u) => (
            <p key={u}><a className="text-slate-300 underline" target="_blank" rel="noreferrer" href={u}>{u}</a></p>
          ))}
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="mb-4 text-xl font-semibold text-amber-200">作品の全体コメント</h2>
        <form onSubmit={onSaveOverallComment} className="space-y-3">
          <textarea value={overallComment} onChange={(e) => setOverallComment(e.target.value)} rows={4} className="w-full rounded-md border border-cyan-400/20 bg-slate-950/70 px-3 py-2 text-sm outline-none transition focus:border-cyan-300" />
          <button type="submit" className="btn-cyan" disabled={isPending}>保存</button>
          {status && <p className="text-sm text-amber-200">{status}</p>}
        </form>
      </section>

      <section className="panel p-6">
        <h2 className="mb-4 text-xl font-semibold text-amber-200">投稿一覧</h2>
        <div className="space-y-3">
          {data.reviews.length === 0 && <p className="text-sm text-slate-400">no reviews yet</p>}
          {data.reviews.map((review) => (
            <article key={review.id} className="rounded-lg border border-slate-700/80 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-amber-200">{review.score} 点</p>
                <p className="text-xs text-slate-400">{new Date(review.created_at).toLocaleString()} / {review.author}</p>
              </div>
              {review.comment && <p className="mt-2 text-sm text-slate-200">{review.comment}</p>}
              {review.source_url && <p className="mt-2 text-xs"><a className="text-cyan-200 underline" href={review.source_url} target="_blank" rel="noreferrer">このレビューの元URLへ</a></p>}
              <div className="mt-2 flex items-center gap-2 text-xs">
                <button type="button" className="rounded border border-slate-700 px-2 py-1 text-slate-200" onClick={() => onReact(review.id, "like")}>いいね {review.likes_count ?? 0}</button>
                <button type="button" className="rounded border border-slate-700 px-2 py-1 text-slate-200" onClick={() => onReact(review.id, "helpful")}>参考になった {review.helpful_count ?? 0}</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(review.tags ?? []).map((tag) => (
                  <span key={`${review.id}-${tag}`} className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">#{tag}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}