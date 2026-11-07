"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/inbox", label: "받은 편지" },
  { href: "/sent", label: "보낸 편지" },
  { href: "/bounced", label: "돌아온 편지" }
];

export default function AppNavigation() {
  const pathname = usePathname();

  return (
    <nav className="topNav" aria-label="메일함">
      {items.map((item) => {
        const current = pathname === item.href || pathname.startsWith(`/mail/${item.href.slice(1)}/`);
        return (
          <Link href={item.href} aria-current={current ? "page" : undefined} key={item.href}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
