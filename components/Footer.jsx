export default function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-700/70 bg-slate-950/70">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 text-xs text-slate-400 md:px-6">
        © {new Date().getFullYear()} AV・Fantia批評空間
      </div>
    </footer>
  );
}