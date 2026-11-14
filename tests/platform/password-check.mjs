import fs from 'node:fs';
import net from 'node:net';
import tls from 'node:tls';
import assert from 'node:assert/strict';
import bcrypt from '/app/node_modules/bcryptjs/index.js';
import {mergeDovecotUser,mergePostfixAccounts,parseDovecotUsers} from '/app/account-core.mjs';
const checks=[];
const record=(name,condition)=>{assert(condition,name);checks.push(name);};
const post=(route,id,password)=>fetch('http://127.0.0.1:3000/api/auth/'+route,{method:'POST',redirect:'manual',body:new URLSearchParams({userId:id,password})});
class IMAP{
 constructor(){this.buffer='';this.lines=[];this.number=0;this.attach(net.connect({host:'imap',port:143}));}
 attach(socket){this.socket=socket;socket.setTimeout(15000,()=>socket.destroy(new Error('IMAP timeout')));socket.on('error',e=>{this.error=e;this.waiter?.reject(e);this.waiter=null;});socket.on('data',b=>{this.buffer+=b.toString();while(this.buffer.includes('\r\n')){const i=this.buffer.indexOf('\r\n');this.lines.push(this.buffer.slice(0,i));this.buffer=this.buffer.slice(i+2);this.flush();}});}
 flush(){if(this.waiter){const i=this.lines.findIndex(x=>this.waiter.pattern.test(x));if(i>=0){const w=this.waiter;this.waiter=null;w.resolve(this.lines.splice(0,i+1).join('\n'));}}}
 read(pattern){if(this.error)return Promise.reject(this.error);return new Promise((resolve,reject)=>{this.waiter={pattern,resolve,reject};this.flush();});}
 async cmd(command){const tag='p'+(++this.number);this.socket.write(tag+' '+command+'\r\n');const text=await this.read(new RegExp('^'+tag+' (OK|NO|BAD)'));return{ok:text.includes(tag+' OK'),text};}
 async tls(){record('IMAP STARTTLS accepted',(await this.cmd('STARTTLS')).ok);this.socket.removeAllListeners('data');const secure=tls.connect({socket:this.socket,servername:'fixture.test',ca:fs.readFileSync(process.env.SMTP_TLS_CA_FILE),rejectUnauthorized:true,minVersion:'TLSv1.2'});await new Promise((resolve,reject)=>{secure.once('secureConnect',resolve);secure.once('error',reject);});record('IMAP certificate and hostname verified',secure.authorized);this.attach(secure);}
 async close(){await this.cmd('LOGOUT');this.socket.destroy();}
}
const usersPath='/accounts/dovecot-users',mapPath='/accounts/virtual-mailbox-accounts';
const before=fs.readFileSync(usersPath,'utf8');
for(const [id,password]of[['rejectshort','a'.repeat(7)],['rejectlong','a'.repeat(129)],['rejectnul','synthetic'+String.fromCharCode(0)+'password'],['..','valid-fixture-password']]){const r=await post('signup',id,password);record('invalid credential rejected without session',r.status===303&&r.headers.get('location').startsWith('/signup?error=')&&!r.headers.has('set-cookie'));}
record('rejected signups leave account data unchanged',fs.readFileSync(usersPath,'utf8')===before);
const cases=[['short-final','Abcdef8!'],['long-final','a'.repeat(127)+'X'],['unicode-final','가'.repeat(128)]];
for(const[id,password]of cases){const signup=await post('signup',id,password);record('8-128 character signup accepted',signup.status===303&&['/inbox','/signup?error=exists'].includes(signup.headers.get('location')));const login=await post('login',id,password);record('full-password Webmail login accepted',login.headers.get('location')==='/inbox');const wrong=await post('login',id,password.slice(0,-1)+'Y');record('different final character rejected',wrong.headers.get('location')==='/login?error=invalid_credentials');await new Promise(resolve=>setTimeout(resolve,1500));const client=new IMAP();await client.read(/^\* OK/);await client.tls();record('full-password IMAP login accepted',(await client.cmd('LOGIN '+JSON.stringify(id)+' '+JSON.stringify(password))).ok);await client.close();}
const legacyId='legacy-fixture';if(!parseDovecotUsers(fs.readFileSync(usersPath,'utf8')).some(x=>x.id===legacyId)){const legacyHash='{BLF-CRYPT}'+await bcrypt.hash(process.env.FIXTURE_PASSWORD,4);fs.writeFileSync(usersPath,mergeDovecotUser(fs.readFileSync(usersPath,'utf8'),legacyId,legacyHash));fs.writeFileSync(mapPath,mergePostfixAccounts(fs.readFileSync(mapPath,'utf8'),legacyId,['fixture.test']));}const beforeLegacy=fs.readFileSync(usersPath,'utf8');await new Promise(resolve=>setTimeout(resolve,1500));
record('legacy bcrypt Webmail login works',(await post('login',legacyId,process.env.FIXTURE_PASSWORD)).headers.get('location')==='/inbox');const legacy=new IMAP();await legacy.read(/^\* OK/);await legacy.tls();record('legacy bcrypt IMAP login works',(await legacy.cmd('LOGIN '+JSON.stringify(legacyId)+' '+JSON.stringify(process.env.FIXTURE_PASSWORD))).ok);await legacy.close();record('legacy credential is not silently rewritten',fs.readFileSync(usersPath,'utf8')===beforeLegacy);record('new account hashes are Argon2id',parseDovecotUsers(fs.readFileSync(usersPath,'utf8')).filter(x=>cases.some(([id])=>id===x.id)).every(x=>x.passwordHash.startsWith('{ARGON2ID}')));
console.log(JSON.stringify({time:new Date().toISOString(),level:'INFO',event:'security.password.compatibility',status:'success',range:'8-128 characters',passed:checks.length,checks}));
