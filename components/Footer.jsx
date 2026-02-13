export default function Footer() {
  return (
    <footer className="mt-16 border-t border-sky-100 bg-white/80">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 text-sm text-slate-500 md:px-6">
        © {new Date().getFullYear()} Tool Portal
      </div>
    </footer>
  );
}
