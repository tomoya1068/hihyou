import { Suspense } from "react";
import SearchClient from "./SearchClient";

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="panel p-6 text-sm text-slate-300">検索画面を準備中...</div>}>
      <SearchClient />
    </Suspense>
  );
}