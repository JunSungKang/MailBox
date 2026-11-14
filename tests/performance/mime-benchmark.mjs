// Run both modes in fresh containers with the same Node/dependencies/input disk.
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { simpleParser } from 'mailparser';
import { pathToFileURL } from 'node:url';

const [mode, input, output] = process.argv.slice(2);
const root = await fs.realpath(process.env.MAILBOX_PERF_ROOT);
for (const name of [input, output]) if (!path.resolve(name).startsWith(root + path.sep)) throw Error('Fixture boundary');
if (!['baseline','candidate'].includes(mode)) throw Error('Expected baseline/candidate');
const {parseMailFile} = await import(pathToFileURL(path.resolve(process.env.MAILBOX_PACKAGE_ROOT || '/app','src/lib/parseMailFile.ts')));
const beforeRss = process.memoryUsage().rss;
const start = performance.now();
let files, bodyTextBytes, bodyHtmlBytes;
if (mode === 'baseline') {
  const parsed = await simpleParser(await fs.readFile(input));
  bodyTextBytes = Buffer.byteLength(parsed.text || ''); bodyHtmlBytes = Buffer.byteLength(typeof parsed.html === 'string' ? parsed.html : '');
  await fs.mkdir(output);
  files = [];
  for (const [i,a] of parsed.attachments.entries()) {const file = path.join(output, String(i));await fs.writeFile(file,a.content);files.push(file);}
} else {
  const parsed = await parseMailFile(input,output);
  bodyTextBytes = Buffer.byteLength(parsed.text || ''); bodyHtmlBytes = Buffer.byteLength(typeof parsed.html === 'string' ? parsed.html : '');
  files = parsed.attachments.map(a=>path.join(output,a.storedName));
}
const elapsedMs=performance.now()-start, peakRssBytes=process.resourceUsage().maxRSS*1024;
const attachments=[];
for(const file of files){const hash=crypto.createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);attachments.push({bytes:(await fs.stat(file)).size,sha256:hash.digest('hex')});}
console.log(JSON.stringify({mode,node:process.version,elapsedMs,peakRssBytes,beforeRss,bodyTextBytes,bodyHtmlBytes,attachments}));
