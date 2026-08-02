import type { Metadata } from "next";
import Link from "next/link";
import { currentUserId } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mail Web",
  description: "File based mail web UI"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const userId = await currentUserId();

  return (
    <html lang="ko">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div>
              <div className="brand">Mail</div>
              <nav className="nav" aria-label="mail navigation">
                <Link href="/compose">메일 보내기</Link>
                <Link href="/inbox">받은 메일함</Link>
                <Link href="/sent">보낸 메일함</Link>
                <Link href="/bounced">반송된 메일함</Link>
              </nav>
            </div>
            <div className="profile">
              <details className="profileMenu">
                <summary>
                  <span className="profileAvatar">{userId ? userId[0]?.toUpperCase() : "?"}</span>
                  <span className="profileText">
                    <span className="profileLabel">프로필</span>
                    <span className="profileName">{userId || "비회원"}</span>
                  </span>
                </summary>
                <div className="profileActions">
                  {userId ? (
                    <form action="/api/auth/logout" method="post">
                      <button type="submit">로그아웃</button>
                    </form>
                  ) : (
                    <>
                      <Link href="/login">로그인</Link>
                      <Link href="/signup">회원가입</Link>
                    </>
                  )}
                </div>
              </details>
            </div>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
