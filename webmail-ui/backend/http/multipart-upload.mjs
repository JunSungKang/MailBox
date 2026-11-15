import Busboy from "busboy";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

// Disk-backed streams, with cleanup owned by the caller after every writer settles.
export async function multipartUpload(req, directory, maxBytes) {
  const fields = { from: "", to: "", subject: "", body: "" };
  const attachments = [];
  const jobs = [];
  const controller = new AbortController();
  let totalBytes = 0,
    failure;
  let parser;
  const reject = (status, message) => {
    failure ??= Object.assign(new Error(message), { status });
    controller.abort();
    req.unpipe();
    req.resume();
    parser.destroy(failure);
  };
  parser = Busboy({
    headers: req.headers,
    limits: { fileSize: maxBytes, fieldSize: 20 * 1024 * 1024 },
  });
  parser.on("field", (name, value, info) => {
    if (info.valueTruncated) reject(413, "메일 요청 필드가 너무 큽니다.");
    if (Object.hasOwn(fields, name)) fields[name] = value;
  });
  parser.on("file", (name, file, info) => {
    if (name !== "attachments" || !info.filename) {
      file.resume();
      return;
    }
    const id = randomUUID(),
      tempPath = path.join(directory, id);
    const attachment = {
      id,
      storedName: id,
      filename: path.basename(info.filename),
      contentType: info.mimeType || "application/octet-stream",
      size: 0,
      tempPath,
    };
    file.on("data", (chunk) => {
      attachment.size += chunk.length;
      totalBytes += chunk.length;
      if (totalBytes > maxBytes)
        reject(413, "첨부파일은 1GB를 초과할 수 없습니다.");
    });
    file.on("limit", () => reject(413, "첨부파일은 1GB를 초과할 수 없습니다."));
    const job = pipeline(file, createWriteStream(tempPath, { flags: "wx" }), {
      signal: controller.signal,
    })
      .then(() => {
        if (attachment.size > 0) attachments.push(attachment);
      })
      .catch((error) => {
        failure ??= error;
        reject(500, "메일을 저장할 수 없습니다.");
      });
    jobs.push(job);
  });
  const abort = () => {
    reject(400, "메일 요청 연결이 종료되었습니다.");
    parser.destroy(failure);
  };
  req.once("aborted", abort);
  try {
    await new Promise((resolve, rejectPromise) => {
      parser.once("finish", resolve);
      parser.once("error", rejectPromise);
      req.once("error", rejectPromise);
      req.pipe(parser);
    });
  } catch (error) {
    failure ??= error;
    controller.abort();
  } finally {
    req.removeListener("aborted", abort);
    await Promise.allSettled(jobs);
  }
  if (failure) throw failure;
  return { fields, attachments, totalBytes };
}
