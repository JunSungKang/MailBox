import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mail Web",
  description: "File based mail web UI"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div className="brand">Mail</div>
            <nav className="nav" aria-label="mail navigation">
              <Link href="/compose">메일 보내기</Link>
              <Link href="/inbox">받은 메일함</Link>
              <Link href="/sent">보낸 메일함</Link>
              <Link href="/bounced">반송된 메일함</Link>
            </nav>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
