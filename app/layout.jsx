import "@/app/globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "俺のおすすめAV",
  description: "レビュー投稿・検索・統計をまとめたサイト",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body className="app-body antialiased">
        <div className="app-backdrop" />
        <div className="relative z-10 flex min-h-screen flex-col">
          <Header />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
