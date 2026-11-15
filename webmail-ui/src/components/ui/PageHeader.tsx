import type { ReactNode } from "react";
export default function PageHeader({
  eyebrow,
  title,
  intro,
  trailing,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="pageHeader">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="pageIntro">{intro}</p>
      </div>
      {trailing}
    </div>
  );
}
