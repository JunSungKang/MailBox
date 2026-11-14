import net from 'node:net';
import tls from 'node:tls';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const phase=process.env.IMAP_CHECK_PHASE||'before';
class IMAP {
 constructor(){this.buffer='';this.lines=[];this.waiter=null;this.number=0;this.attach(net.connect({host:'imap',port:143}));}
 attach(socket){this.socket=socket;socket.setTimeout(15000,()=>socket.destroy(new Error('IMAP timeout')));socket.on('error',error=>{this.failure=error;this.waiter?.reject(error);this.waiter=null;});socket.on('data',chunk=>{this.buffer+=chunk.toString();while(this.buffer.includes('\r\n')){let i=this.buffer.indexOf('\r\n');let line=this.buffer.slice(0,i);this.buffer=this.buffer.slice(i+2);this.lines.push(line);this.flush();}});}
 flush(){if(this.waiter&&this.lines.some(line=>this.waiter.match.test(line))){let waiter=this.waiter;this.waiter=null;let last=this.lines.findIndex(line=>waiter.match.test(line));waiter.resolve(this.lines.splice(0,last+1).join('\n'));}}
 read(match){if(this.failure)return Promise.reject(this.failure);return new Promise((resolve,reject)=>{this.waiter={match,resolve,reject};this.flush();});}
 async cmd(command){const tag='a'+(++this.number);this.socket.write(tag+' '+command+'\r\n');const text=await this.read(new RegExp('^'+tag+' (OK|NO|BAD)'));return {ok:text.includes(tag+' OK'),text};}
 async startTLS(){assert((await this.cmd('STARTTLS')).ok);this.socket.removeAllListeners('data');const secure=tls.connect({socket:this.socket,servername:process.env.SMTP_TLS_SERVERNAME,ca:fs.readFileSync(process.env.SMTP_TLS_CA_FILE),minVersion:'TLSv1.2',rejectUnauthorized:true});await new Promise((resolve,reject)=>{secure.once('secureConnect',resolve);secure.once('error',reject);});this.attach(secure);assert(secure.authorized);}
}
const client=new IMAP();await client.read(/^\* OK/);
const clear=await client.cmd('LOGIN "fixture-user" "unused-probe"');assert(!clear.ok,'plaintext IMAP login must fail');
await client.startTLS();
assert((await client.cmd(`LOGIN "fixture-user@fixture.test" "${process.env.FIXTURE_PASSWORD}"`)).ok,'existing bcrypt account login');
const selection=await client.cmd('SELECT INBOX');assert(selection.ok);
const validity=selection.text.match(/UIDVALIDITY (\d+)/)?.[1];const count=Number(selection.text.match(/\* (\d+) EXISTS/)?.[1]);assert(validity&&count>0);
if(phase==='before') assert((await client.cmd('UID STORE 1:* '+(process.env.FLAG_ACTION==='clear'?'-':'+')+'FLAGS.SILENT (\\Seen)')).ok);
const metadata=await client.cmd('UID FETCH 1:* (UID FLAGS RFC822.SIZE)');assert(metadata.ok);
const uids=[...metadata.text.matchAll(/UID (\d+)/g)].map(match=>match[1]);
const seen=[...metadata.text.matchAll(/FLAGS \(([^)]*)\)/g)].map(match=>match[1].includes('\\Seen'));
assert(seen.length>0&&seen.every(x=>x===(process.env.EXPECTED_SEEN!=='false')));
const snapshot={uidValidity:validity,count,uids,seen};const file='/app/data/imap-migration-snapshot.json';
if(phase==='before')fs.writeFileSync(file,JSON.stringify(snapshot),{mode:0o600});
else assert.deepEqual(snapshot,JSON.parse(fs.readFileSync(file,'utf8')),'UIDVALIDITY, UIDs, count and Seen flags preserved');
assert((await client.cmd('LOGOUT')).ok);client.socket.destroy();
console.log(JSON.stringify({time:new Date().toISOString(),level:'INFO',event:'security.imap.migration',phase,status:'success',plaintextLoginDenied:true,verifiedTls:true,bcryptLogin:true,snapshot}));
