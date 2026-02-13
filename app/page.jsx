"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { getHomeData } from "./review/actions";

function formatNumber(value) {
  if (value === null || Number.isNaN(value)) return "-";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export default function HomePage() {
  const [data, setData] = useState({ latestReviews: [], hotProducts: [] });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getHomeData();
      setData(result);
    });
  }, []);

  return (
    <div className="space-y-8">
      <section className="panel-gold p-7 md:p-8">
        <p className="text-xs uppercase tracking-[0.35em] text-amber-300/90">AV / Fantia Review Nexus</p>
        <h1 className="mt-3 text-3xl font-bold tracking-wide text-amber-200 md:text-4xl">AV・Fantia批評空間</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
          作品単位でレビューを集約し、平均点・中央値・新着感想を横断して確認できます。
          URL解析は FANZA の <code>cid=...</code> / <code>id=...</code> と Fantia の <code>/posts/...</code> に対応しています。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/search" className="btn-cyan">作品を検索する</Link>
          <Link href="/review/new" className="btn-gold">批評を投稿する</Link>
        </div>
      </section>

      <section className="panel p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-cyan-200">注目作品</h2>
          {isPending && <span className="text-xs text-slate-400">読み込み中...</span>}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {data.hotProducts.map((p) => (
            <Link
              key={`${p.platform}-${p.productId}`}
              href={`/search?q=${encodeURIComponent(`${p.platform}:${p.productId}`)}`}
              className="rounded-xl border border-slate-700/80 bg-slate-950/60 p-4 transition hover:border-amber-300/50"
            >
              <p className="text-xs uppercase tracking-wider text-cyan-300">{p.platform}</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-100">{p.productName}</p>
              <p className="truncate text-xs text-slate-400">{p.productId}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="text-slate-500">平均</p>
                  <p className="font-semibold text-amber-200">{formatNumber(p.average)}</p>
                </div>
                <div>
                  <p className="text-slate-500">中央値</p>
                  <p className="font-semibold text-amber-200">{formatNumber(p.median)}</p>
                </div>
                <div>
                  <p className="text-slate-500">件数</p>
                  <p className="font-semibold text-amber-200">{p.total}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="mb-4 text-xl font-semibold text-amber-200">新着レビュー</h2>
        <div className="space-y-3">
          {data.latestReviews.map((review) => (
            <article key={review.id} className="rounded-lg border border-slate-700/80 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-cyan-300">
                  {review.platform} / {review.product_id}
                </p>
                <p className="text-xs text-slate-400">{new Date(review.created_at).toLocaleString()}</p>
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-100">{review.product_name || review.product_id}</p>
              <p className="mt-2 text-2xl font-bold text-amber-200">{review.score} 点</p>
              {review.comment && <p className="mt-2 text-sm text-slate-200">{review.comment}</p>}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}