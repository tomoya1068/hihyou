import Link from "next/link";
import { Blocks } from "lucide-react";

export default function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-sky-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="rounded-lg bg-teal-600 p-1.5 text-white">
            <Blocks className="h-4 w-4" />
          </span>
          Tool Portal
        </Link>
        <nav>
          <Link
            href="/review"
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            AV・Fantia批評空間
          </Link>
        </nav>
      </div>
    </header>
  );
}
