import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import ComposeForm from "./ComposeForm";

type ComposePageProps = { searchParams: Promise<{ to?: string; subject?: string }> };
export const metadata = { title: "편지 쓰기" };

export default async function ComposePage({ searchParams }: ComposePageProps) {
  const userId = await currentUserId();
  if (!userId) redirect("/login");
  const query = await searchParams;

  return (
    <>
      <div className="pageHeader">
        <div>
          <p className="eyebrow">New letter</p>
          <h1>새 편지를 띄워요</h1>
          <p className="pageIntro">말을 고르고, 마음을 담아, 가볍게 보내세요.</p>
        </div>
      </div>
      <section className="panel">
        <ComposeForm userId={userId} defaultTo={query.to || ""} defaultSubject={query.subject || ""} />
      </section>
    </>
  );
}
