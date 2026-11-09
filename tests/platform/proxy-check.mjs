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
const redirect=await request(false,'/login?next=%2Finbox');assert.equal(redirect.status,308);assert.equal(redirect.headers.location,'https://fixture.test:20006/login?next=%2Finbox');
const login=await request(true,'/login');assert.equal(login.status,200);
await assert.rejects(request(true,'/login','GET','',{}, {servername:'wrong.invalid'}));
await assert.rejects(request(true,'/login','GET','',{}, {ca:undefined}));
const body=new URLSearchParams({userId:process.env.SMTP_AUTH_USER,password:process.env.SMTP_AUTH_PASSWORD}).toString();
const auth=await request(true,'/api/auth/login','POST',body,{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body),'X-Forwarded-For':'198.51.100.77'});assert.equal(auth.status,303);assert.equal(auth.headers.location,'/inbox');
const cookie=auth.headers['set-cookie']?.join(';')||'';assert(/; Secure/i.test(cookie));assert(/; HttpOnly/i.test(cookie));assert(/; SameSite=Lax/i.test(cookie));
const inbox=await request(true,'/inbox','GET','',{'Cookie':cookie.split(';')[0]});assert.equal(inbox.status,200);
console.log(JSON.stringify({time:new Date().toISOString(),level:'INFO',event:'security.proxy.integration',status:'success',httpRedirect308:true,uriAndQueryPreserved:true,httpsVerified:true,wrongHostnameRejected:true,untrustedCertificateRejected:true,loginAndInbox:true,secureHttpOnlySameSiteCookie:true}));
