import Link from "next/link";

type SignupPageProps = {
  searchParams: Promise<{
    error?: string | string[];
  }>;
};
export const metadata = { title: "계정 만들기" };

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function errorMessage(error: string): string {
  if (error === "exists") return "이미 가입된 아이디입니다.";
  if (error === "invalid") return "아이디는 영문 소문자, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다.";
  if (error === "weak_password") return "비밀번호는 12자 이상 128자 이하로 입력해야 합니다.";
  if (error === "invalid_signup_token") return "가입 코드가 올바르지 않습니다.";
  if (error === "unavailable") return "계정을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  return "";
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { error } = await searchParams;
  const message = errorMessage(firstValue(error));

  return (
    <div className="authWrap">
      <div className="pageHeader">
        <p className="eyebrow">Your own sky</p>
        <h1>새 편지함을 만들어요</h1>
        <p className="pageIntro">한 번의 가입으로 웹메일 주소와 IMAP 계정이 함께 준비됩니다.</p>
      </div>
      <section className="panel authPanel">
        <form className="form" action="/api/auth/signup" method="post">
          <div className="field">
            <label htmlFor="userId">아이디</label>
            <input id="userId" name="userId" type="text" autoComplete="username" required autoFocus />
            <p className="fieldHint">영문 소문자, 숫자, 점, 밑줄, 하이픈을 사용할 수 있어요.</p>
          </div>
          <div className="field">
            <label htmlFor="password">비밀번호</label>
            <input id="password" name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required />
            <p className="fieldHint">12자 이상 128자 이하로 입력해 주세요.</p>
          </div>
          <div className="field">
            <label htmlFor="signupToken">가입 코드</label>
            <input id="signupToken" name="signupToken" type="password" autoComplete="off" required />
          </div>
          {message ? <p className="status error" role="alert">{message}</p> : null}
          <div className="actions">
            <button className="button" type="submit">
              내 하늘 만들기
            </button>
          </div>
        </form>
      </section>
      <p className="authSwitch">이미 편지함이 있나요? <Link className="textLink" href="/login">로그인하기</Link></p>
    </div>
  );
}
