import fs from 'node:fs';
import assert from 'node:assert/strict';
const [beforeFile,afterFile,queueMode='strict']=process.argv.slice(2);
assert(['strict','live-queue'].includes(queueMode));
const before=JSON.parse(fs.readFileSync(beforeFile)),after=JSON.parse(fs.readFileSync(afterFile));
for(const field of ['accounts','accountEntries','maildirFlags','uidValidity','uidMappings','webData'])for(const [key,value]of Object.entries(before[field]))assert.deepEqual(after[field][key],value,'Original '+field+' changed');
const counts=new Map();for(const m of after.messages)counts.set(m.sha256,(counts.get(m.sha256)||0)+1);for(const m of before.messages){assert((counts.get(m.sha256)||0)>0,'Original message missing');counts.set(m.sha256,counts.get(m.sha256)-1);}
let owners=0;for(const [key,value]of Object.entries(before.ownership))if(after.ownership[key]){assert.deepEqual(after.ownership[key],value,'Original ownership/mode changed');owners++;}
for(const key of before.importedKeys)assert(after.importedKeys.includes(key),'Original import ledger entry missing');
assert.deepEqual(after.authSocket,before.authSocket);
if(queueMode==='strict')assert.deepEqual(after.queue,before.queue,'Held fixture queue changed');
console.log(JSON.stringify({status:'success',originalAccounts:Object.keys(before.accounts).length,accountsAfter:Object.keys(after.accounts).length,originalMessages:before.messageCount,messagesAfter:after.messageCount,originalCacheFiles:Object.keys(before.webData).length,importLedgerEntriesRetained:before.importedKeys.length,ownershipEntriesCompared:owners,sharedSocket:after.authSocket,queueMode,queueFilesBefore:Object.keys(before.queue).length,queueFilesAfter:Object.keys(after.queue).length}));
