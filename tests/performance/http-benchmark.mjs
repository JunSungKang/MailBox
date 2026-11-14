// Only targets a locally isolated fixture; never use production credentials.
import https from 'node:https';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const [caFile, authFile, portValue = '20008', trialsValue = '3'] = process.argv.slice(2);
const port = Number(portValue);
const host = process.env.MAILBOX_PERF_IN_DOCKER === '1' ? 'proxy' : '127.0.0.1';
assert(host === 'proxy' ? port === 443 : port >= 20007 && port <= 20009, 'Fixture endpoint only');
const auth = JSON.parse(fs.readFileSync(authFile));
assert.equal(auth.user, 'fixture-user');
const ca = fs.readFileSync(caFile);
const agent = new https.Agent({keepAlive: true, maxSockets: 8});
function request(path, method='GET', body='', headers={}) {
  return new Promise((resolve,reject) => {
    const start = performance.now();
    const req = https.request({host,port,servername:'mailbox.fixture.test',ca,rejectUnauthorized:true,agent,path,method,headers},res=>{
      let bytes=0;res.on('data',chunk=>{bytes+=chunk.length;});res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,bytes,ms:performance.now()-start}));
    });req.on('error',reject);req.setTimeout(30000,()=>req.destroy(Error('Fixture HTTP timeout')));req.end(body);
  });
}
try {
  const form=new URLSearchParams({userId:auth.user,password:auth.password}).toString();
  const login=await request('/api/auth/login','POST',form,{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(form)});
  assert.equal(login.status,303);const cookie=login.headers['set-cookie'][0].split(';')[0];
  const headers={Cookie:cookie};
  for(let wave=0;wave<6;wave++)await Promise.all(Array.from({length:8},async()=>assert.equal((await request('/inbox','GET','',headers)).status,200)));
  const results=[];
  for(let trial=0;trial<Number(trialsValue);trial++){
    let next=0;const rows=[],start=performance.now();
    await Promise.all(Array.from({length:8},async()=>{while(next++<96){const r=await request('/inbox','GET','',headers);assert.equal(r.status,200);assert(r.bytes>1000);rows.push(r.ms);}}));
    const elapsedMs=performance.now()-start;rows.sort((a,b)=>a-b);results.push({trial,requests:rows.length,concurrency:8,elapsedMs,requestsPerSecond:rows.length*1000/elapsedMs,p50Ms:rows[Math.floor(rows.length*.5)],p95Ms:rows[Math.ceil(rows.length*.95)-1]});
  }
  console.log(JSON.stringify({event:'test.performance.https',node:process.version,warmupRequests:48,results}));
} finally {agent.destroy();}
