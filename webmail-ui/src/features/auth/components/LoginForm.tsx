import FormField from "@/components/ui/FormField";
import StatusMessage from "@/components/ui/StatusMessage";
export default function LoginForm({ message }: { message: string }) {
  return (
    <form className="form" action="/api/auth/login" method="post">
      <FormField id="userId" label="아이디">
        <input
          id="userId"
          name="userId"
          type="text"
          autoComplete="username"
          required
          autoFocus
        />
      </FormField>
      <FormField id="password" label="비밀번호">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </FormField>
      {message ? <StatusMessage announce>{message}</StatusMessage> : null}
      <div className="actions">
        <button className="button" type="submit">
          편지함 열기
        </button>
      </div>
    </form>
  );
}
