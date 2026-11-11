import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pipeline } from "node:stream/promises";
import type { AttachmentStream, Headers, AddressObject } from "mailparser";

export type StoredAttachment = {
  id: string; filename: string; contentType: string; size: number; storedName: string;
};

// The directory must be new. Never use a MIME filename as a filesystem path.
export async function parseMailFile(sourcePath: string, attachmentsDirectory: string) {
  await fs.mkdir(attachmentsDirectory);
  const controller = new AbortController();
  const jobs = new Set<Promise<void>>();
  try {
    // Existing inboxes do not need to load the MIME stack just to list metadata.
    const { MailParser } = await import("mailparser");
    const parser = new MailParser();
    const stored = new WeakMap<AttachmentStream, string>();
    const attachments: StoredAttachment[] = [];
    let headers: Headers = new Map();
    let text: string | undefined;
    parser.on("headers", value => { headers = value; });
    parser.on("data", part => {
      if (part.type === "text") { text = part.text; return; }
      const id = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
      const target = path.join(attachmentsDirectory, id);
      const job = (async () => {
        try {
          await pipeline(part.content, createWriteStream(target, { flags: "wx" }), { signal: controller.signal });
          stored.set(part, target);
          attachments.push({ id, storedName: id, filename: part.filename || "attachment",
            contentType: part.contentType || "application/octet-stream", size: part.size ?? (await fs.stat(target)).size });
          part.release?.();
        } catch (error) { parser.destroy(error as Error); }
      })();
      jobs.add(job);
      void job.then(() => jobs.delete(job));
    });
    await pipeline(createReadStream(sourcePath), parser, { signal: controller.signal });
    await Promise.all(jobs);
    // Use the same CID conversion and inlining budget as simpleParser. Only
    // referenced inline images need a buffer; ordinary attachments stay on disk.
    const html = await new Promise<string | false | undefined>((resolve, reject) => {
      parser.updateImageLinks((part, done) => {
        const file = stored.get(part);
        if (!file) { done(new Error("Missing stored inline image")); return; }
        void fs.readFile(file).then(bytes => done(null, `data:${part.contentType};base64,${bytes.toString("base64")}`), error => done(error));
      }, (error, value) => error ? reject(error) : resolve(value));
    });
    return { headers, attachments, text, html, subject: headers.get("subject") as string | undefined,
      from: headers.get("from") as AddressObject | undefined,
      to: headers.get("to") as AddressObject | AddressObject[] | undefined,
      date: headers.get("date") as Date | undefined };
  } catch (error) {
    controller.abort();
    await Promise.allSettled(jobs);
    await fs.rm(attachmentsDirectory, { recursive: true, force: true });
    throw error;
  }
}
