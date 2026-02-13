"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { getHomeData } from "./review/actions";

export default function HomePage() {
  const [data, setData] = useState({ latestReviews: [], newReleases: [], error: null });
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
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/search" className="btn-cyan">検索</Link>
          <Link href="/review/new" className="btn-gold">投稿</Link>
        </div>
      </section>

      {data.error && <p className="panel p-4 text-sm text-rose-300">{data.error}</p>}

      <section className="panel p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-cyan-200">新作コーナー（FANZA 2時間更新）</h2>
          {isPending && <span className="text-xs text-slate-400">loading...</span>}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.newReleases.map((p) => (
            <article key={p.productId} className="rounded-xl border border-slate-700/80 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-wider text-cyan-300">fanza / {p.productId}</p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-100">{p.title}</p>
              <div className="mt-3 flex gap-2">
                <Link href={`/title/fanza/${p.productId}`} className="btn-cyan">作品ページ</Link>
                <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="btn-gold">元サイト</a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="mb-4 text-xl font-semibold text-amber-200">新着レビュー</h2>
        <div className="space-y-3">
          {data.latestReviews.map((review) => (
            <Link key={review.id} href={`/title/${review.platform}/${review.product_id}`} className="block rounded-lg border border-slate-700/80 bg-slate-950/60 p-4 transition hover:border-cyan-300/50">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-cyan-300">{review.platform} / {review.product_id}</p>
                <p className="text-xs text-slate-400">{new Date(review.created_at).toLocaleString()}</p>
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-100">{review.product_name || review.product_id}</p>
              <p className="mt-2 text-2xl font-bold text-amber-200">{review.score} 点</p>
              {review.comment && <p className="mt-2 text-sm text-slate-200">{review.comment}</p>}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}