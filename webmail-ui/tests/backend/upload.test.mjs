import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { multipartUpload } from "../../backend/http/multipart-upload.mjs";

async function fixture(callback) {
  const root = path.resolve(process.env.MAILBOX_TEST_TMP || ".");
  const directory = await fs.mkdtemp(path.join(root, "multipart-"));
  try {
    await callback(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
function request(bytes) {
  const req = Readable.from([bytes]);
  req.headers = { "content-type": "multipart/form-data; boundary=fixture" };
  return req;
}
const body = Buffer.from(
  '--fixture\r\nContent-Disposition: form-data; name="body"\r\n\r\nfixture text\r\n--fixture\r\nContent-Disposition: form-data; name="attachments"; filename="fixture.txt"\r\nContent-Type: text/plain\r\n\r\nattachment fixture\r\n--fixture--\r\n',
);
test("multipart upload preserves disk-backed bytes and excludes filesystem names", () =>
  fixture(async (directory) => {
    const parsed = await multipartUpload(request(body), directory, 1024);
    assert.equal(parsed.fields.body, "fixture text");
    assert.equal(parsed.attachments.length, 1);
    const attachment = parsed.attachments[0];
    assert.equal(
      await fs.readFile(attachment.tempPath, "utf8"),
      "attachment fixture",
    );
    assert.notEqual(attachment.storedName, attachment.filename);
  }));
test("multipart size failure settles file writers before caller cleanup", () =>
  fixture(async (directory) => {
    await assert.rejects(
      multipartUpload(request(body), directory, 3),
      (error) => error.status === 413,
    );
    await fs.rm(directory, { recursive: true });
    assert.equal(await fs.stat(directory).catch(() => null), null);
  }));
test("malformed multipart input rejects instead of hanging", () =>
  fixture(async (directory) => {
    await assert.rejects(
      multipartUpload(request(Buffer.from("invalid")), directory, 1024),
    );
  }));

test("a file writer open failure ends the parser and returns rather than hanging", () =>
  fixture(async (directory) => {
    await assert.rejects(
      multipartUpload(request(body), path.join(directory, "missing"), 1024),
      (error) => error.code === "ENOENT",
    );
  }));

test('attachment resolution rejects symlink escapes and cross-user access',()=>fixture(async directory=>{
 const {createAttachmentService}=await import('../../backend/application/get-attachment.mjs');
 const root=path.join(directory,'mail'),message=path.join(root,'inbox','fixture'),outside=path.join(directory,'outside');await fs.mkdir(message+'/attachments',{recursive:true});await fs.mkdir(outside);await fs.writeFile(outside+'/data','synthetic outside data');
 await fs.writeFile(message+'/meta.json',JSON.stringify({box:'inbox',to:['one@fixture.test'],attachments:[{id:'file',storedName:'file'}]}));await fs.symlink(outside+'/data',message+'/attachments/file');
 const get=createAttachmentService({root});await assert.rejects(get({actor:'one',box:'inbox',id:'fixture',attachmentId:'file'}),{status:404});await assert.rejects(get({actor:'two',box:'inbox',id:'fixture',attachmentId:'file'}),{status:403});
}));
