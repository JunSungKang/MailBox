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
  description: "내일이 먼저 말을 걸어오는 곳, MailBox 내일의 우편함"
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
        <div className="timeField" aria-hidden="true">
          <span className="lightVeil lightVeilMint" />
          <span className="lightVeil lightVeilViolet" />
          <span className="timeOrbit timeOrbitOne" />
          <span className="timeOrbit timeOrbitTwo" />
          <span className="timeSpark timeSparkOne" />
          <span className="timeSpark timeSparkTwo" />
        </div>
        <div className="appShell">
          <header className="topBar">
            <Link className="brand" href={userId ? "/inbox" : "/login"} aria-label="MailBox 홈">
              <span className="brandMark" aria-hidden="true">
                <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <ellipse cx="16" cy="16" rx="14" ry="7" transform="rotate(-35 16 16)" />
                  <rect x="9" y="11" width="14" height="10" rx="2" />
                  <path d="m10 12 6 5 6-5" />
                </svg>
              </span>
              <span className="brandText"><strong>MailBox</strong><small>내일의 우편함</small></span>
            </Link>
            {userId ? <AppNavigation /> : <p className="guestGreeting">내일이 먼저 말을 걸어오는 곳.</p>}
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
          <footer className="footer"><span className="footerOrbit" aria-hidden="true">◎</span> MailBox · 내일의 우편함</footer>
        </div>
      </body>
    </html>
  );
}
