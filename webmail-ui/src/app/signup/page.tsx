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
