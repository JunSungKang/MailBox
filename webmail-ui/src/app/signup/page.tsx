import Link from "next/link";
import AuthShell from "@/features/auth/components/AuthShell";
import SignupForm from "@/features/auth/components/SignupForm";
import { signupError } from "@/features/auth/model/auth-errors";
import { firstValue } from "@/shared/query";
export const metadata = { title: "계정 만들기" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthShell
      eyebrow="Your next chapter"
      title="당신의 내일을 연결해요"
      intro="한 번의 가입으로 웹메일 주소와 IMAP 계정이 함께 준비됩니다."
      alternate={
        <>
          이미 편지함이 있나요?{" "}
          <Link className="textLink" href="/login">
            로그인하기
          </Link>
        </>
      }
    >
      <SignupForm message={signupError(firstValue(error))} />
    </AuthShell>
  );
}
