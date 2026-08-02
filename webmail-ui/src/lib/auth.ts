import { cookies } from "next/headers";

export const authCookieName = "webmail_user";

export function normalizeUserId(value: string | undefined): string {
  return (value || "").trim().toLowerCase();
}

export function isValidUserId(value: string): boolean {
  return /^[a-z0-9._-]{1,64}$/.test(value);
}

export async function currentUserId(): Promise<string> {
  const cookieStore = await cookies();
  const userId = normalizeUserId(cookieStore.get(authCookieName)?.value);
  return isValidUserId(userId) ? userId : "";
}
