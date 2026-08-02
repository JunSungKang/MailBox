type SignupPageProps = {
  searchParams: Promise<{
    error?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function errorMessage(error: string): string {
  if (error === "exists") return "이미 가입된 아이디입니다.";
  if (error === "invalid") return "아이디는 영문 소문자, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다.";
  if (error === "weak_password") return "비밀번호는 12자 이상 128자 이하로 입력해야 합니다.";
  if (error === "unknown_mailbox") return "등록된 메일 주소의 아이디만 가입할 수 있습니다.";
  if (error === "invalid_signup_token") return "가입 코드가 올바르지 않습니다.";
  return "";
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { error } = await searchParams;
  const message = errorMessage(firstValue(error));

  return (
    <>
      <div className="pageHeader">
        <h1>회원가입</h1>
      </div>
      <section className="panel authPanel">
        <form className="form" action="/api/auth/signup" method="post">
          <div className="field">
            <label htmlFor="userId">아이디</label>
            <input id="userId" name="userId" type="text" autoComplete="username" required />
          </div>
          <div className="field">
            <label htmlFor="password">비밀번호</label>
            <input id="password" name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required />
          </div>
          <div className="field">
            <label htmlFor="signupToken">가입 코드</label>
            <input id="signupToken" name="signupToken" type="password" autoComplete="off" required />
          </div>
          {message ? <p className="status error">{message}</p> : null}
          <div className="actions">
            <button className="button" type="submit">
              계정 생성
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
