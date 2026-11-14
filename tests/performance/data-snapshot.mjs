// Read-only, streaming fingerprints. Run with only the five intended mounts.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const digestFile=async file=>{const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex')};
const owner=file=>{const s=fs.statSync(file);return[s.uid,s.gid,s.mode&4095]};
const out={accounts:{},accountEntries:{},messages:[],uidValidity:{},uidMappings:{},maildirFlags:{},queue:{},ownership:{},webData:{},importedKeys:[]};
async function walk(base,dir=base){for(const e of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,e.name);out.ownership[sha(file)]=owner(file);
 if(e.isDirectory()){await walk(base,file);continue;}if(!e.isFile())continue;
 if(base==='/mailboxes'){
  if(['new','cur'].includes(path.basename(path.dirname(file)))){out.messages.push({sha256:await digestFile(file),bytes:fs.statSync(file).size});out.maildirFlags[sha(path.dirname(path.dirname(file))+'/'+e.name.split(':2,')[0])]=path.basename(path.dirname(file))==='cur'?(e.name.split(':2,')[1]||''):'';}
  if(e.name==='dovecot-uidlist'){const lines=fs.readFileSync(file,'utf8').split('\n'),v=lines[0].match(/\bV(\d+)/)?.[1];if(v)out.uidValidity[sha(file)]=v;for(const line of lines.slice(1)){const m=line.match(/^(\d+)\s+[^:]*:(.+)$/);if(m)out.uidMappings[sha(path.dirname(file)+'/'+m[2].split(':2,')[0])]=m[1];}}
 }
 if(base==='/queue'&&['active','incoming','deferred','hold','maildrop','saved'].includes(path.relative(base,file).split('/')[0]))out.queue[sha(path.relative(base,file))]=await digestFile(file);
 if(base==='/webdata'){if(e.name==='maildir-imported.json')out.importedKeys=JSON.parse(fs.readFileSync(file,'utf8')).map(sha).sort();else out.webData[sha(path.relative(base,file))]=await digestFile(file);}
}}
for(const base of ['/mailboxes','/accounts','/queue','/webdata','/auth'])if(fs.existsSync(base)){out.ownership[sha(base)]=owner(base);await walk(base);}
if(fs.existsSync('/accounts/dovecot-users'))for(const line of fs.readFileSync('/accounts/dovecot-users','utf8').split(/\r?\n/).filter(x=>x&&!x.startsWith('#')))out.accounts[sha(line.split(':')[0])]=sha(line);
if(fs.existsSync('/accounts/virtual-mailbox-accounts'))for(const line of fs.readFileSync('/accounts/virtual-mailbox-accounts','utf8').split(/\r?\n/).filter(x=>x&&!x.startsWith('#'))){const [address,target]=line.trim().split(/\s+/);out.accountEntries[sha(address)]=sha(target||'');}
if(fs.existsSync('/auth/auth'))out.authSocket=owner('/auth/auth');
out.messages.sort((a,b)=>a.sha256.localeCompare(b.sha256));out.messageCount=out.messages.length;
console.log(JSON.stringify(out));
