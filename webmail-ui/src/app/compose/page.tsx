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
          <p className="eyebrow">A new transmission</p>
          <h1>다음 이야기를 보내요</h1>
          <p className="pageIntro">지금의 한마디가 누군가의 새로운 하루에 닿도록.</p>
        </div>
      </div>
      <section className="panel">
        <ComposeForm userId={userId} defaultTo={query.to || ""} defaultSubject={query.subject || ""} />
      </section>
    </>
  );
}
