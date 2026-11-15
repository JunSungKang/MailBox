import type { ReactNode } from "react";
import TemporalEmblem from "@/components/layout/TemporalEmblem";
import PageHeader from "@/components/ui/PageHeader";
export default function AuthShell({
  eyebrow,
  title,
  intro,
  alternate,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  alternate: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="authWrap">
      <TemporalEmblem />
      <PageHeader eyebrow={eyebrow} title={title} intro={intro} />
      <section className="panel authPanel">{children}</section>
      <p className="authSwitch">{alternate}</p>
    </div>
  );
}
