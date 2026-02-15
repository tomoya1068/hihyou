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
        <p className="text-xs uppercase tracking-[0.35em] text-amber-300/90">AV / Fantia Review</p>
        <h1 className="mt-3 text-3xl font-bold tracking-wide text-amber-200 md:text-4xl">みんなのおすすめAV</h1>
        <p className="mt-3 text-sm text-slate-200">このサイトの使い方: URLで作品を探して、気になったらレビューを投稿。</p>
        <p className="mt-1 text-sm text-amber-200">おすすめしたいAVがあったら投稿してね。</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/search" className="btn-cyan">作品検索</Link>
          <Link href="/review/new" className="btn-gold">レビュー投稿</Link>
        </div>
      </section>

      <section className="flex justify-end">
        <aside className="w-full max-w-sm rounded-xl border border-cyan-400/30 bg-slate-950/80 p-4 text-sm">
          <p className="text-xs uppercase tracking-wider text-cyan-300">掲示板</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">ご要望板</h2>
          <p className="mt-2 text-slate-300">ほしい機能や改善案があれば、レビュー投稿から気軽に書いてください。</p>
          <Link href="/review/new" className="mt-3 inline-block text-cyan-200 underline">ご要望を書く</Link>
        </aside>
      </section>

      {data.error && <p className="panel p-4 text-sm text-rose-300">{data.error}</p>}

      <section className="panel p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-amber-200">最新レビュー</h2>
          {isPending && <span className="text-xs text-slate-400">loading...</span>}
        </div>
        <div className="space-y-3">
          {data.latestReviews.map((review) => (
            <Link
              key={review.id}
              href={`/title/${review.platform}/${review.product_id}`}
              className="block rounded-lg border border-slate-700/80 bg-slate-950/60 p-4 transition hover:border-cyan-300/50"
            >
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
