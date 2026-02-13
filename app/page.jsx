"use client";

import ToolGridClient from "@/components/ToolGridClient";

export default function HomePage() {
  return (
    <>
      <section className="rounded-3xl border border-sky-100 bg-white/80 p-6 shadow-sm md:p-8">
        <p className="text-sm font-medium text-teal-700">Monetize Ready</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">HTML/JSツールを高速で公開するポータル</h1>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600 md:text-base">一覧ページと個別ページをすぐ運用できる構成です。</p>
      </section>
      <ToolGridClient />
    </>
  );
}
