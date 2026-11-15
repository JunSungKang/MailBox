export function loginError(error: string): string {
  if (error === "invalid_credentials")
    return "아이디 또는 비밀번호가 올바르지 않습니다.";
  if (error === "invalid")
    return "아이디는 영문 소문자, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다.";
  if (error === "unavailable")
    return "지금은 로그인 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.";
  return "";
}

export function signupError(error: string): string {
  if (error === "exists") return "이미 가입된 아이디입니다.";
  if (error === "invalid")
    return "아이디는 영문 소문자, 숫자, 점, 밑줄, 하이픈만 사용할 수 있으며 점 한 개 또는 두 개는 사용할 수 없습니다.";
  if (error === "weak_password")
    return "비밀번호는 8~128자로 입력해야 하며 널 문자를 포함할 수 없습니다.";
  if (error === "unavailable")
    return "계정을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  return "";
}
