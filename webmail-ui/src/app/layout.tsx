import type { Metadata } from "next";
import Link from "next/link";
import { currentUserId } from "@/lib/auth";
import AppNavigation from "./AppNavigation";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MailBox",
    template: "%s · MailBox"
  },
  description: "하늘처럼 가볍게 주고받는 MailBox 웹메일"
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
        <a className="skipLink" href="#main-content">본문으로 바로가기</a>
        <div className="sky" aria-hidden="true">
          <span className="cloud cloudOne" />
          <span className="cloud cloudTwo" />
          <span className="cloud cloudThree" />
        </div>
        <div className="appShell">
          <header className="topBar">
            <Link className="brand" href={userId ? "/inbox" : "/login"} aria-label="MailBox 홈">
              <span className="brandMark" aria-hidden="true">✦</span>
              <span>MailBox</span>
            </Link>
            {userId ? <AppNavigation /> : <p className="guestGreeting">당신의 조용한 하늘 편지함</p>}
            <div className="accountArea">
              {userId ? (
                <>
                  <Link className="composeButton" href="/compose"><span aria-hidden="true">＋</span> 편지 쓰기</Link>
                  <details className="profileMenu">
                    <summary aria-label={`${userId} 계정 메뉴`}>
                      <span className="profileAvatar">{userId[0]?.toUpperCase()}</span>
                      <span className="profileName">{userId}</span>
                    </summary>
                    <div className="profileActions">
                      <form action="/api/auth/logout" method="post">
                        <button type="submit">로그아웃</button>
                      </form>
                    </div>
                  </details>
                </>
              ) : (
                <nav className="guestNav" aria-label="계정">
                  <Link href="/login">로그인</Link>
                  <Link className="softButton" href="/signup">계정 만들기</Link>
                </nav>
              )}
            </div>
          </header>
          <main className="main" id="main-content">{children}</main>
          <footer className="footer">MailBox · 마음을 가볍게 전하는 공간</footer>
        </div>
      </body>
    </html>
  );
}
