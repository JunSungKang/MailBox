import http from 'node:http';
import {execFileSync} from 'node:child_process';
const socketPath=(process.env.DOCKER_HOST||'').replace(/^unix:\/\//,'');
if(!socketPath.startsWith('/'))throw Error('Pin the actual Docker unix endpoint');
const get=url=>new Promise((resolve,reject)=>{const q=http.get({socketPath,path:url},r=>{let data='';r.on('data',x=>data+=x);r.on('end',()=>r.statusCode===200?resolve(JSON.parse(data)):reject(Error('Docker stats unavailable')));});q.on('error',reject);});
const rows=[];
for(const name of process.argv.slice(2)){
 const d=await get('/containers/'+encodeURIComponent(name)+'/json');
 const s=await get('/containers/'+encodeURIComponent(name)+'/stats?stream=false&one-shot=true');
 const raw=execFileSync('docker',['exec',name,'cat','/sys/fs/cgroup/memory.swap.current','/proc/1/status'],{encoding:'utf8'});
 const status=Object.fromEntries([...raw.matchAll(/^(VmRSS|VmHWM|VmSwap):\s+(\d+) kB/gm)].map(m=>[m[1],Number(m[2])*1024]));
 const cache=s.memory_stats.stats?.inactive_file||0;
 rows.push({name,id:d.Id,image:d.Image,time:s.read,memoryBytes:s.memory_stats.usage,inactiveFileBytes:cache,workingSetBytes:Math.max(0,s.memory_stats.usage-cache),swapBytes:Number(raw.split('\n')[0]),pids:s.pids_stats.current,pid1:status});
}
console.log(JSON.stringify(rows));
