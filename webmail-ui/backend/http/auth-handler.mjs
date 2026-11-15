import crypto from "node:crypto";
import { auditLog, auditWarn, auditError } from "../shared/audit-logger.mjs";
import { requestContext } from "./request-context.mjs";
import { redirect, sendText } from "./responses.mjs";

const generatedId = () =>
  Date.now() + "-" + crypto.randomBytes(8).toString("hex");
import {
  isValidPassword,
  isValidUserId,
  mayProvisionServiceAccount,
  normalizeUserId,
  sessionToken,
  verifySessionToken,
} from "../domain/session.mjs";
export function createAuthHandler({
  config,
  registerAccount,
  passwordMatchesAccount,
}) {
  const { AUTH_COOKIE, SESSION_SECRET, COOKIE_SECURE, MAX_AUTH_BODY_BYTES } =
    config;
  function requestUserId(req) {
    const cookies = String(req.headers.cookie || "").split(";");
    for (const cookie of cookies) {
      const [name, ...parts] = cookie.trim().split("=");
      if (name === AUTH_COOKIE) {
        try {
          return verifySessionToken(
            decodeURIComponent(parts.join("=")),
            SESSION_SECRET,
          );
        } catch {
          return "";
        }
      }
    }
    return "";
  }

  async function parseUrlEncodedForm(req) {
    const chunks = [];
    let totalBytes = 0;
    for await (const chunk of req) {
      totalBytes += chunk.length;
      if (totalBytes > MAX_AUTH_BODY_BYTES) {
        throw new Error("Authentication request body is too large");
      }
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks).toString("utf8");
    return new URLSearchParams(body);
  }

  function setAuthCookie(res, userId) {
    const secure = COOKIE_SECURE ? "; Secure" : "";
    res.setHeader(
      "Set-Cookie",
      `${AUTH_COOKIE}=${encodeURIComponent(sessionToken(userId, SESSION_SECRET))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`,
    );
  }

  function clearAuthCookie(res) {
    res.setHeader(
      "Set-Cookie",
      `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    );
  }

  async function handleAuth(req, res, pathname) {
    const startedAt = Date.now();
    const context = requestContext(req, pathname);

    if (pathname === "/api/auth/logout") {
      clearAuthCookie(res);
      auditLog("INFO", "auth.logout", {
        ...context,
        durationMs: Date.now() - startedAt,
      });
      redirect(res, "/inbox");
      return true;
    }

    if (pathname !== "/api/auth/login" && pathname !== "/api/auth/signup") {
      return false;
    }

    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("application/x-www-form-urlencoded")) {
      sendText(
        res,
        415,
        "application/x-www-form-urlencoded 요청만 지원합니다.",
      );
      return true;
    }

    let form;
    try {
      form = await parseUrlEncodedForm(req);
    } catch (error) {
      auditWarn("auth.request.rejected", {
        ...context,
        status: 413,
        error,
        durationMs: Date.now() - startedAt,
      });
      sendText(res, 413, "인증 요청 본문이 너무 큽니다.");
      return true;
    }
    const userId = normalizeUserId(form.get("userId")?.toString());
    const password = form.get("password")?.toString() || "";
    if (!isValidUserId(userId)) {
      auditWarn("auth.request.rejected", {
        ...context,
        reason: "invalid_user_id",
        status: 303,
        durationMs: Date.now() - startedAt,
      });
      redirect(
        res,
        pathname === "/api/auth/login"
          ? "/login?error=invalid"
          : "/signup?error=invalid",
      );
      return true;
    }

    if (pathname === "/api/auth/login") {
      try {
        if (!(await passwordMatchesAccount(userId, password))) {
          auditWarn("auth.login.invalid_credentials", {
            ...context,
            userId,
            durationMs: Date.now() - startedAt,
          });
          redirect(res, "/login?error=invalid_credentials");
          return true;
        }
      } catch (error) {
        auditError("auth.login.backend_failure", {
          ...context,
          userId,
          status: 503,
          error,
          durationMs: Date.now() - startedAt,
        });
        redirect(res, "/login?error=unavailable");
        return true;
      }
    }

    let provisionedAccount;
    if (pathname === "/api/auth/signup") {
      if (
        userId === normalizeUserId(process.env.SMTP_AUTH_USER) &&
        !mayProvisionServiceAccount(
          req.socket.remoteAddress,
          password,
          process.env.SMTP_AUTH_PASSWORD,
        )
      ) {
        auditWarn("auth.signup.reserved_id", {
          ...context,
          userId,
          reason: "service_account",
          status: 303,
          durationMs: Date.now() - startedAt,
        });
        redirect(res, "/signup?error=exists");
        return true;
      }
      if (!isValidPassword(password)) {
        auditWarn("auth.signup.invalid_password", {
          ...context,
          userId,
          status: 303,
          durationMs: Date.now() - startedAt,
        });
        redirect(res, "/signup?error=weak_password");
        return true;
      }
      try {
        provisionedAccount = await registerAccount({
          userId,
          password,
          remoteAddress: req.socket.remoteAddress,
        });
      } catch (error) {
        if (error?.code === "ACCOUNT_EXISTS") {
          auditWarn("auth.signup.exists", {
            ...context,
            userId,
            durationMs: Date.now() - startedAt,
          });
          redirect(res, "/signup?error=exists");
          return true;
        }
        auditError("auth.signup.provision_failure", {
          ...context,
          userId,
          status: 503,
          error,
          durationMs: Date.now() - startedAt,
        });
        redirect(res, "/signup?error=unavailable");
        return true;
      }
    }

    setAuthCookie(res, userId);
    auditLog(
      "INFO",
      pathname === "/api/auth/signup"
        ? "auth.signup.success"
        : "auth.login.success",
      {
        ...context,
        actor: userId,
        userId,
        addressCount: provisionedAccount?.addressCount,
        domains: provisionedAccount?.domains,
        durationMs: Date.now() - startedAt,
      },
    );
    redirect(res, "/inbox");
    return true;
  }

  return { handleAuth, requestUserId };
}
