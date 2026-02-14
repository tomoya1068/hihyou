import Link from "next/link";

const navItems = [
  { href: "/", label: "ホーム" },
  { href: "/search", label: "検索" },
  { href: "/review/new", label: "投稿" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-700/70 bg-slate-950/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 md:px-6">
        <Link href="/" className="text-sm font-bold tracking-[0.2em] text-amber-300 md:text-base">
          みんなのおすすめAV
        </Link>
        <nav className="flex items-center gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md border border-slate-700/80 bg-slate-900/70 px-3 py-1.5 text-sm text-slate-200 transition hover:border-cyan-300/50 hover:text-cyan-200"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
