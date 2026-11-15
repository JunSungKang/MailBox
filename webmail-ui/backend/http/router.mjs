import { auditError } from "../shared/audit-logger.mjs";
import { requestContext } from "./request-context.mjs";
import { sendText } from "./responses.mjs";
export function createRouter(services, nextHandler) {
  return async (req, res) => {
    try {
      const pathname = new URL(req.url || "/", "http://localhost").pathname;
      if (req.method === "POST" && pathname === "/api/send") {
        await services.handleSend(req, res);
        return;
      }
      if (
        req.method === "POST" &&
        (await services.handleAuth(req, res, pathname))
      )
        return;
      if (
        req.method === "GET" &&
        (await services.handleDownload(req, res, pathname))
      )
        return;
      await nextHandler(req, res);
    } catch (error) {
      auditError("http.request.failure", {
        ...requestContext(req),
        status: 500,
        error,
      });
      if (!res.headersSent && !res.destroyed)
        sendText(res, 500, "요청을 처리할 수 없습니다.");
      else res.destroy();
    }
  };
}
