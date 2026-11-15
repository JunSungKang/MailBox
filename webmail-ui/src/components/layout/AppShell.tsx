import type { ReactNode } from "react";
import Link from "next/link";
import AppNavigation from "./AppNavigation";
import { sourceArchiveUrl } from "@/shared/source-link";
export default function AppShell({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  return (
    <div className="appShell">
      <header className="topBar">
        <Link
          className="brand"
          href={userId ? "/inbox" : "/login"}
          aria-label="MailBox 홈"
        >
          <span className="brandMark" aria-hidden="true">
            <svg
              viewBox="0 0 32 32"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <ellipse
                cx="16"
                cy="16"
                rx="14"
                ry="7"
                transform="rotate(-35 16 16)"
              />
              <rect x="9" y="11" width="14" height="10" rx="2" />
              <path d="m10 12 6 5 6-5" />
            </svg>
          </span>
          <span className="brandText">
            <strong>MailBox</strong>
            <small>내일의 우편함</small>
          </span>
        </Link>
        {userId ? (
          <AppNavigation />
        ) : (
          <p className="guestGreeting">내일이 먼저 말을 걸어오는 곳.</p>
        )}
        <div className="accountArea">
          {userId ? (
            <>
              <Link className="composeButton" href="/compose">
                <span aria-hidden="true">＋</span> 편지 쓰기
              </Link>
              <details className="profileMenu">
                <summary aria-label={`${userId} 계정 메뉴`}>
                  <span className="profileAvatar">
                    {userId[0]?.toUpperCase()}
                  </span>
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
              <Link className="softButton" href="/signup">
                계정 만들기
              </Link>
            </nav>
          )}
        </div>
      </header>
      <main className="main" id="main-content">
        {children}
      </main>
      <footer className="footer">
        <span className="footerOrbit" aria-hidden="true">
          ◎
        </span>{" "}
        MailBox · 내일의 우편함
        <span className="footerLinks">
          <a href={sourceArchiveUrl()} aria-label="MailBox 소스코드 내려받기">
            소스코드
          </a>
          <a href="https://www.gnu.org/licenses/agpl-3.0.html">AGPL-3.0-only</a>
        </span>
      </footer>
    </div>
  );
}
