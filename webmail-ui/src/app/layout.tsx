import type { Metadata } from "next";
import { currentUserId } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MailBox",
    template: "%s · MailBox",
  },
  description: "내일이 먼저 말을 걸어오는 곳, MailBox 내일의 우편함",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const userId = await currentUserId();

  return (
    <html lang="ko">
      <body>
        <a className="skipLink" href="#main-content">
          본문으로 바로가기
        </a>
        <div className="timeField" aria-hidden="true">
          <span className="lightVeil lightVeilMint" />
          <span className="lightVeil lightVeilViolet" />
          <span className="timeOrbit timeOrbitOne" />
          <span className="timeOrbit timeOrbitTwo" />
          <span className="timeSpark timeSparkOne" />
          <span className="timeSpark timeSparkTwo" />
        </div>
        <AppShell userId={userId}>{children}</AppShell>
      </body>
    </html>
  );
}
