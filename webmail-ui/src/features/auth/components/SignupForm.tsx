import FormField from "@/components/ui/FormField";
import StatusMessage from "@/components/ui/StatusMessage";
export default function SignupForm({ message }: { message: string }) {
  return (
    <form className="form" action="/api/auth/signup" method="post">
      <FormField id="userId" label="아이디">
        <input
          id="userId"
          name="userId"
          type="text"
          autoComplete="username"
          required
          autoFocus
        />
        <p className="fieldHint">
          영문 소문자, 숫자, 점, 밑줄, 하이픈을 사용할 수 있어요. 점 한 개 또는
          두 개만으로 된 아이디는 사용할 수 없어요.
        </p>
      </FormField>
      <FormField id="password" label="비밀번호">
        <input
          id="password"
          name="password"
          type="password"
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          required
        />
        <p className="fieldHint">8~128자로 입력해 주세요.</p>
        <p className="fieldHint">
          이전에 사용하던 계정은 기존 비밀번호로 가입해 주세요.
        </p>
      </FormField>
      {message ? <StatusMessage announce>{message}</StatusMessage> : null}
      <div className="actions">
        <button className="button" type="submit">
          내 편지함 만들기
        </button>
      </div>
    </form>
  );
}
