import Link from "next/link";
import TemporalEmblem from "../TemporalEmblem";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
  }>;
};
export const metadata = { title: "로그인" };

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function errorMessage(error: string): string {
  if (error === "invalid_credentials") return "아이디 또는 비밀번호가 올바르지 않습니다.";
  if (error === "invalid") return "아이디는 영문 소문자, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다.";
  if (error === "unavailable") return "지금은 로그인 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.";
  return "";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  const message = errorMessage(firstValue(error));

  return (
    <div className="authWrap">
      <TemporalEmblem />
      <div className="pageHeader">
        <p className="eyebrow">A letter from tomorrow</p>
        <h1>내일의 우편함을 열어요</h1>
        <p className="pageIntro">익숙한 하루에 도착한, 조금은 신비로운 이야기.</p>
      </div>
      <section className="panel authPanel">
        <form className="form" action="/api/auth/login" method="post">
          <div className="field">
            <label htmlFor="userId">아이디</label>
            <input id="userId" name="userId" type="text" autoComplete="username" required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="password">비밀번호</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {message ? <p className="status error" role="alert">{message}</p> : null}
          <div className="actions">
            <button className="button" type="submit">
              편지함 열기
            </button>
          </div>
        </form>
      </section>
      <p className="authSwitch">처음 오셨나요? <Link className="textLink" href="/signup">새 계정 만들기</Link></p>
    </div>
  );
}
