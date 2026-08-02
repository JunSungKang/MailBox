import { cookies } from "next/headers";
import { normalizeUserId, isValidUserId, verifySessionToken } from "../../auth-core.mjs";

export const authCookieName = "webmail_user";

export { normalizeUserId, isValidUserId };

export async function currentUserId(): Promise<string> {
  const cookieStore = await cookies();
  const token = cookieStore.get(authCookieName)?.value || "";
  const dev = process.env.NODE_ENV !== "production";
  const secret = process.env.WEBMAIL_SESSION_SECRET || (dev ? "local-development-only" : "");
  return verifySessionToken(token, secret);
}
