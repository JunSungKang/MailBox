import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const ca=fs.readFileSync(process.env.SMTP_TLS_CA_FILE);
function request(secure,path,method='GET',body='',headers={},override={}){
 return new Promise((resolve,reject)=>{
  const req=(secure?https:http).request({hostname:'proxy',port:secure?8443:8080,path,method,...(secure?{ca,servername:process.env.SMTP_TLS_SERVERNAME,rejectUnauthorized:true}:{}),headers,...override},res=>{let buffer='';res.on('data',chunk=>buffer+=chunk.toString());res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:buffer}));});
  req.on('error',reject);req.setTimeout(10000,()=>req.destroy(new Error('Proxy timeout')));req.end(body);
 });
}

const body=new URLSearchParams({userId:'fixture-user',password:process.env.FIXTURE_PASSWORD}).toString();
const auth=await request(true,'/api/auth/login','POST',body,{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body)});assert.equal(auth.status,303);assert.equal(auth.headers.location,'/inbox');
const cookie=auth.headers['set-cookie']?.join(';')||'';assert(/; Secure/i.test(cookie));
const pages=await Promise.all(Array.from({length:Number(process.env.REQUESTS||5)},()=>request(true,'/inbox','GET','',{'Cookie':cookie.split(';')[0]})));
const expected=Number(process.env.EXPECTED_WEBMAIL_COUNT);
for(const page of pages){assert.equal(page.status,200);assert.equal(Number(page.body.match(/class="countPill"[^>]*>(\d+)/)?.[1]),expected);assert.equal((page.body.match(/class="mailRow"/g)||[]).length,expected);}
console.log(JSON.stringify({time:new Date().toISOString(),level:'INFO',event:'test.platform.webmail.count',status:'success',messages:expected,concurrentRequests:pages.length}));
