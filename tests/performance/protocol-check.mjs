// Run inside the isolated fixture Webmail only, after importing local fixtures.
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
assert.equal(process.env.MAIL_DOMAINS,'fixture.test');
const ca=fs.readFileSync(process.env.SMTP_TLS_CA_FILE);
function request(secure,url,method='GET',body='',headers={},options={}){
 return new Promise((resolve,reject)=>{
  const hash=crypto.createHash('sha256');let bytes=0;
  const req=(secure?https:http).request({host:'proxy',port:secure?443:80,path:url,method,headers,...(secure?{ca,servername:process.env.SMTP_TLS_SERVERNAME,rejectUnauthorized:true}:{}),...options},res=>{
   res.on('data',chunk=>{bytes+=chunk.length;hash.update(chunk)});res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,bytes,sha256:hash.digest('hex')}));
  });req.on('error',reject);req.setTimeout(60000,()=>req.destroy(Error('Fixture request timeout')));req.end(body);
 });
}
async function login(userId,password){const body=new URLSearchParams({userId,password}).toString();const r=await request(true,'/api/auth/login','POST',body,{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body)});assert.equal(r.status,303);const cookie=r.headers['set-cookie'][0];assert(/; Secure/i.test(cookie)&&/; HttpOnly/i.test(cookie)&&/; SameSite=Lax/i.test(cookie));return {Cookie:cookie.split(';')[0]};}
const redirect=await request(false,'/login?next=%2Finbox');assert.equal(redirect.status,308);assert.equal(redirect.headers.location,'https://localhost:20008/login?next=%2Finbox');
await assert.rejects(request(true,'/login','GET','',{}, {servername:'wrong.invalid'}));
await assert.rejects(request(true,'/login','GET','',{}, {ca:[]}));
const headers=await login('fixture-user',process.env.FIXTURE_PASSWORD);
const other=await login(process.env.SMTP_AUTH_USER,process.env.SMTP_AUTH_PASSWORD);
let attachments=0,largeBodyBytes=0;
const root='/app/data/mail/inbox';
for(const entry of fs.readdirSync(root,{withFileTypes:true}).filter(x=>x.isDirectory())){
 const dir=path.join(root,entry.name);const m=JSON.parse(fs.readFileSync(path.join(dir,'meta.json'),'utf8'));
 for(const a of m.attachments||[]){
  const url=`/api/mail/inbox/${m.id}/attachments/${a.id}`;
  const r=await request(true,url,'GET','',headers);assert.equal(r.status,200);assert.equal(r.bytes,a.size);
  const digest=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(path.join(dir,'attachments',a.storedName)))digest.update(chunk);assert.equal(r.sha256,digest.digest('hex'));
  assert([303,401,403].includes((await request(true,url)).status));assert([403,404].includes((await request(true,url,'GET','',other)).status));attachments++;
 }
 if(m.subject==='Large plain fixture'){
  const sourceBytes=fs.statSync(path.join(dir,'body.txt')).size;assert(sourceBytes>48*1024*1024);
  const r=await request(true,`/mail/inbox/${m.id}`,'GET','',headers);assert.equal(r.status,200);assert(r.bytes>sourceBytes);largeBodyBytes=r.bytes;
 }
}
assert(attachments>=2,'Original and new streamed large attachments');assert(largeBodyBytes>0,'Large body detail was read');
console.log(JSON.stringify({time:new Date().toISOString(),level:'INFO',event:'test.performance.protocol',status:'success',verifiedTls:true,unknownCaAndHostnameRejected:true,secureCookies:true,attachmentBytesAndOwnership:true,attachments,largeBodyResponseBytes:largeBodyBytes,externalDataSent:false}));
