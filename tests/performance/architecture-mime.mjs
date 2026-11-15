// Same-input streaming parser comparison; run once per fresh container.
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
const [modulePath,input,output]=process.argv.slice(2);
if(!path.resolve(input).startsWith('/fixture/')||!path.resolve(output).startsWith('/fixture/'))throw Error('Fixture paths required');
const {parseMailFile}=await import(modulePath);
const start=performance.now(),parsed=await parseMailFile(input,output);
const elapsedMs=performance.now()-start,peakRssBytes=process.resourceUsage().maxRSS*1024;
const attachments=[];for(const attachment of parsed.attachments){const hash=crypto.createHash('sha256');for await(const bytes of createReadStream(path.join(output,attachment.storedName)))hash.update(bytes);attachments.push({bytes:attachment.size,sha256:hash.digest('hex')});}
console.log(JSON.stringify({elapsedMs,peakRssBytes,text:parsed.text,attachments}));
await fs.rm(output,{recursive:true});
