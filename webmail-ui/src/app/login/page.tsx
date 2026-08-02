type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function errorMessage(error: string): string {
  if (error === "not_found") return "가입된 아이디가 없습니다.";
  if (error === "invalid") return "아이디는 영문 소문자, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다.";
  return "";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  const message = errorMessage(firstValue(error));

  return (
    <>
      <div className="pageHeader">
        <h1>로그인</h1>
      </div>
      <section className="panel authPanel">
        <form className="form" action="/api/auth/login" method="post">
          <div className="field">
            <label htmlFor="userId">아이디</label>
            <input id="userId" name="userId" type="text" autoComplete="username" required />
          </div>
          {message ? <p className="status error">{message}</p> : null}
          <div className="actions">
            <button className="button" type="submit">
              로그인
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
