import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { simpleParser } from 'mailparser';
import { parseMailFile } from './src/lib/parseMailFile.ts';

const base = path.resolve(process.env.MAILBOX_TEST_TMP || '.agents/performance-tests');
async function fixture(t, raw) {
  await fs.mkdir(base, {recursive: true});
  const dir = await fs.mkdtemp(path.join(base, 'mime-'));
  t.after(() => fs.rm(dir, {recursive: true, force: true}));
  const file = path.join(dir, 'input.eml'); await fs.writeFile(file, raw);
  return {file, dir, out: path.join(dir, 'attachments')};
}
const head = 'From: Fixture <from@fixture.test>\r\nTo: one@fixture.test, two@fixture.test\r\nSubject: =?UTF-8?B?7YWM7Iqk7Yq4?=\r\nDate: Tue, 10 Nov 2026 12:00:00 +0000\r\nMIME-Version: 1.0\r\n';
async function compare(t, raw) {
  const f = await fixture(t, raw), expected = await simpleParser(raw), actual = await parseMailFile(f.file, f.out);
  for (const field of ['subject','text','html','from','to','date','headers']) assert.deepEqual(actual[field], expected[field], field);
  assert.equal(actual.attachments.length, expected.attachments.length);
  for (let i = 0; i < expected.attachments.length; i++) {
    const a = actual.attachments[i], e = expected.attachments[i];
    assert.equal(a.filename, e.filename || 'attachment'); assert.equal(a.contentType, e.contentType); assert.equal(a.size, e.size);
    assert.deepEqual(await fs.readFile(path.join(f.out, a.storedName)), e.content);
    assert.match(a.storedName, /^[A-Za-z0-9-]+$/);
  }
  return {f, actual};
}
test('streaming preserves Unicode headers and plain text', async t => {
  await compare(t, head + 'Content-Type: text/plain; charset=utf-8\r\n\r\n안녕하세요\r\n');
});
test('streaming preserves alternative HTML and inline CID conversion', async t => {
  const raw = head + 'Content-Type: multipart/related; boundary=fixture\r\n\r\n--fixture\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p>hello<img src="cid:pixel"></p>\r\n--fixture\r\nContent-Type: image/png\r\nContent-ID: <pixel>\r\nContent-Disposition: inline; filename="pixel.png"\r\nContent-Transfer-Encoding: base64\r\n\r\naGVsbG8=\r\n--fixture--\r\n';
  const {actual} = await compare(t, raw); assert.match(actual.html, /data:image\/png;base64,aGVsbG8=/);
});
test('multiple binary attachments preserve order and never use MIME paths', async t => {
  const raw = head + 'Content-Type: multipart/mixed; boundary=x\r\n\r\n--x\r\nContent-Type: text/plain\r\n\r\nbody\r\n' + ['../../escape.bin','normal.bin'].map((name,i) => '--x\r\nContent-Type: application/octet-stream\r\nContent-Disposition: attachment; filename="'+name+'"\r\nContent-Transfer-Encoding: base64\r\n\r\n'+Buffer.from([0,255,i,128]).toString('base64')+'\r\n').join('')+'--x--\r\n';
  await compare(t, raw);
});
test('source read failures remove owned partial output', async t => {
  const f = await fixture(t, 'unused'); await fs.rm(f.file);
  await assert.rejects(parseMailFile(f.file, f.out), {code: 'ENOENT'});
  await assert.rejects(fs.stat(f.out), {code: 'ENOENT'});
});
test('pre-existing output directories and their contents are preserved', async t => {
  const f = await fixture(t, head+'\r\nbody'); await fs.mkdir(f.out); const sentinel = path.join(f.out, 'original'); await fs.writeFile(sentinel, 'original');
  await assert.rejects(parseMailFile(f.file, f.out), {code:'EEXIST'}); assert.equal(await fs.readFile(sentinel, 'utf8'), 'original');
});
