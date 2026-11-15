import Link from "next/link";
import AuthShell from "@/features/auth/components/AuthShell";
import LoginForm from "@/features/auth/components/LoginForm";
import { loginError } from "@/features/auth/model/auth-errors";
import { firstValue } from "@/shared/query";
export const metadata = { title: "로그인" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthShell
      eyebrow="A letter from tomorrow"
      title="내일의 우편함을 열어요"
      intro="익숙한 하루에 도착한, 조금은 신비로운 이야기."
      alternate={
        <>
          처음 오셨나요?{" "}
          <Link className="textLink" href="/signup">
            새 계정 만들기
          </Link>
        </>
      }
    >
      <LoginForm message={loginError(firstValue(error))} />
    </AuthShell>
  );
}
