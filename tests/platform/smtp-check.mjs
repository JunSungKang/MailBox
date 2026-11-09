import net from 'node:net';
import tls from 'node:tls';
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createSubmissionTransport } from '/app/smtp-transport.mjs';

const checks = [];
const check = (name, condition) => { assert(condition, name); checks.push(name); };
class SMTP {
  constructor(port) { this.responses=[]; this.waiters=[]; this.buffer=''; this.attach(net.connect({host:'smtp',port})); }
  attach(socket) {
    this.socket=socket;
    socket.setTimeout(15000,()=>socket.destroy(new Error('SMTP probe timeout')));socket.on('error',error=>{this.failure=error;for(const w of this.waiters.splice(0))w.reject(error);});
    socket.on('data', chunk=>{
      this.buffer+=chunk;
      while(this.buffer.includes('\r\n')) {
        const i=this.buffer.indexOf('\r\n');const line=this.buffer.slice(0,i);this.buffer=this.buffer.slice(i+2);
        this.lines=(this.lines||[]).concat(line);
        if(/^\d{3} /.test(line)) {
          const result={code:Number(line.slice(0,3)),text:this.lines.join('\n')};this.lines=[];
          const resolve=this.waiters.shift();if(resolve)resolve.resolve(result);else this.responses.push(result);
        }
      }
    });
  }
  read(){if(this.failure)return Promise.reject(this.failure);return this.responses.length?Promise.resolve(this.responses.shift()):new Promise((resolve,reject)=>this.waiters.push({resolve,reject}));}
  async cmd(command){this.socket.write(command+'\r\n');return this.read();}
  async startTLS(){check('submission STARTTLS accepted',(await this.cmd('STARTTLS')).code===220);this.socket.removeAllListeners('data');const socket=tls.connect({socket:this.socket,servername:process.env.SMTP_TLS_SERVERNAME,ca:fs.readFileSync(process.env.SMTP_TLS_CA_FILE),rejectUnauthorized:true,minVersion:'TLSv1.2'});await new Promise((resolve,reject)=>{socket.once('secureConnect',resolve);socket.once('error',reject);});this.attach(socket);await this.cmd('EHLO probe.fixture.test');}
  auth(user,pass){return this.cmd('AUTH PLAIN '+Buffer.from('\0'+user+'\0'+pass).toString('base64'));}
  async envelope(){check('MAIL accepted',(await this.cmd('MAIL FROM:<sender@fixture.test>')).code===250);return this.cmd('RCPT TO:<outside@relay.invalid>');}
  async close(){await this.cmd('RSET');await this.cmd('QUIT');this.socket.destroy();}
}
const password=process.env.FIXTURE_PASSWORD;
const response=await fetch('http://127.0.0.1:3000/api/auth/signup',{method:'POST',redirect:'manual',body:new URLSearchParams({userId:'fixture-user',password,signupToken:process.env.WEBMAIL_SIGNUP_TOKEN})});
check('fixture account provisioned through API',response.status===303 && ['/inbox','/signup?error=exists'].includes(response.headers.get('location')));
await new Promise(resolve=>setTimeout(resolve,2500));
let smtp=new SMTP(2525);await smtp.read();let ehlo=await smtp.cmd('EHLO untrusted.fixture.test');
check('public listener offers STARTTLS',ehlo.text.includes('STARTTLS'));
check('public listener does not offer AUTH',!ehlo.text.includes('AUTH'));
check('private network peer denied external relay',(await smtp.envelope()).code===554);
check('new local recipient accepted without reload',(await smtp.cmd('RCPT TO:<fixture-user@fixture.test>')).code===250);await smtp.close();
smtp=new SMTP(2587);await smtp.read();ehlo=await smtp.cmd('EHLO untrusted.fixture.test');check('AUTH hidden before TLS',!ehlo.text.includes('AUTH'));
check('submission rejects plaintext MAIL',(await smtp.cmd('MAIL FROM:<sender@fixture.test>')).code===530);await smtp.startTLS();
check('submission rejects anonymous external relay',(await smtp.envelope()).code===554);await smtp.close();
smtp=new SMTP(2587);await smtp.read();await smtp.cmd('EHLO probe.fixture.test');await smtp.startTLS();
check('wrong password rejected',(await smtp.auth(process.env.SMTP_AUTH_USER,crypto.randomBytes(32).toString('hex'))).code===535);await smtp.close();
smtp=new SMTP(2587);await smtp.read();await smtp.cmd('EHLO probe.fixture.test');await smtp.startTLS();
check('ordinary user authenticates',(await smtp.auth('fixture-user',password)).code===235);
check('ordinary IMAP user denied service relay',(await smtp.envelope()).code===554);await smtp.close();
smtp=new SMTP(2587);await smtp.read();await smtp.cmd('EHLO probe.fixture.test');await smtp.startTLS();
check('service account authenticates',(await smtp.auth(process.env.SMTP_AUTH_USER,process.env.SMTP_AUTH_PASSWORD)).code===235);
check('service account authorized to submit',(await smtp.envelope()).code===250);await smtp.close();
if(process.env.SKIP_DELIVERY!=="true"){await createSubmissionTransport().sendMail({from:'sender@fixture.test',to:'fixture-user@fixture.test',subject:'isolated security fixture',text:'Maildir delivery fixture only'});
check('verified TLS submission and local fixture delivery queued',true);}
console.log(JSON.stringify({time:new Date().toISOString(),level:'INFO',event:'security.smtp.integration',checks,passed:checks.length}));
