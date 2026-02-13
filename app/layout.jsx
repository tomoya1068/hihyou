import "@/app/globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Tool Portal",
  description: "HTML/JSツールをまとめた収益化対応ポータル"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body className="text-slate-900 antialiased">
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 md:px-6">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
