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

for(const port of [25,2525]){const c=new SMTP(port);await c.read();const e=await c.cmd('EHLO nontrusted.fixture.test');check('receive '+port+' STARTTLS available',e.text.includes('STARTTLS'));check('receive '+port+' AUTH absent',!e.text.includes('AUTH'));check('receive '+port+' external relay denied',(await c.envelope()).code===554);check('receive '+port+' local recipient accepted',(await c.cmd('RCPT TO:<fixture-user@fixture.test>')).code===250);await c.close();}
for(const port of [587,2587]){let c=new SMTP(port);await c.read();let e=await c.cmd('EHLO probe.fixture.test');check('submission '+port+' AUTH hidden before TLS',!e.text.includes('AUTH'));check('submission '+port+' plaintext rejected',(await c.cmd('MAIL FROM:<sender@fixture.test>')).code===530);await c.startTLS();check('submission '+port+' anonymous relay denied',(await c.envelope()).code===554);await c.close();c=new SMTP(port);await c.read();await c.cmd('EHLO probe.fixture.test');await c.startTLS();check('submission '+port+' wrong password denied',(await c.auth(process.env.SMTP_AUTH_USER,crypto.randomBytes(32).toString('hex'))).code===535);await c.close();c=new SMTP(port);await c.read();await c.cmd('EHLO probe.fixture.test');await c.startTLS();check('submission '+port+' ordinary account authenticated',(await c.auth('fixture-user',process.env.FIXTURE_PASSWORD)).code===235);check('submission '+port+' ordinary relay denied',(await c.envelope()).code===554);await c.close();c=new SMTP(port);await c.read();await c.cmd('EHLO probe.fixture.test');await c.startTLS();check('submission '+port+' service authenticated',(await c.auth(process.env.SMTP_AUTH_USER,process.env.SMTP_AUTH_PASSWORD)).code===235);check('submission '+port+' service relay authorized',(await c.envelope()).code===250);await c.close();}
console.log(JSON.stringify({time:new Date().toISOString(),level:'INFO',event:'test.platform.listener_boundaries',status:'success',passed:checks.length,checks,externalDataSent:false}));
