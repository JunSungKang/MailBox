// Reusable destructive fixture test: refuses production projects and volumes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const [configFile, candidateFile, reportDirectory] = process.argv.slice(2).map(x => fs.realpathSync(path.resolve(x)));
const root = fs.realpathSync(process.cwd());
for (const file of [configFile, candidateFile, reportDirectory]) assert(file.startsWith(root + path.sep));
let config = JSON.parse(fs.readFileSync(configFile));
assert(config.name.startsWith('mailbox-ubuntu-check-'));
for (const volume of Object.values(config.volumes)) assert(volume.name.startsWith('mailbox-ubuntu-fixture-') && !volume.external);
const original = structuredClone(config);
const candidates = JSON.parse(fs.readFileSync(candidateFile));
const compose = ['compose', '--env-file', path.join(path.dirname(configFile), 'secrets.env'), '-f', configFile];
const run = (args, options = {}) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options });
const command = (...args) => run([...compose, ...args]);
const save = (name, data) => fs.writeFileSync(path.join(reportDirectory, name + '.json'), JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
const log = (event, extra = {}) => console.log(JSON.stringify({ time: new Date().toISOString(), level: 'INFO', event, actor: 'isolated-platform-test', ...extra }));
function checkScript(file, env = {}) {
  const args = ['exec', '-T', '--user', '5000:5000'];
  for (const [key, value] of Object.entries(env)) args.push('-e', key + '=' + value);
  return JSON.parse(command(...args, 'mailbox-webmail-ui', 'node', '/checks/' + file));
}
function queue() {
  return command('exec', '-T', 'mailbox-smtp-receiver', 'postqueue', '-j').split('\n').filter(Boolean).map(x => {
    const row = JSON.parse(x); return { id: row.queue_id, state: row.queue_name, bytes: row.message_size };
  });
}
async function ready() {
  for (let i = 0; i < 60; i++) {
    try {
      command('exec', '-T', '--user', '5000:5000', 'mailbox-webmail-ui', 'node', '-e', "Promise.all([fetch('http://127.0.0.1:3000/login').then(r=>{if(r.status!==200)throw Error('not ready')}),import('/app/smtp-transport.mjs').then(x=>{const t=x.createSubmissionTransport();return t.verify().finally(()=>t.close())})]).catch(()=>process.exit(1))");
      return;
    } catch { await delay(1000); }
  }
  throw new Error('Fixture failed readiness; inspect its scoped logs');
}
function snapshot(name) {
  const args = ['run', '--rm', '-i', '--network', 'none', '--read-only', '--entrypoint', 'node'];
  for (const [volume, target] of Object.entries({ 'mailbox-store': '/mailboxes', 'smtp-queue-store': '/queue', 'mailbox-account-store': '/accounts', 'webmail-data-store': '/webdata', 'smtp-auth-store': '/auth' })) {
    args.push('--mount', `type=volume,src=${config.volumes[volume].name},dst=${target},readonly`);
  }
  args.push(candidates['smtp-receiver'].imageId, '--input-type=module');
  const data = JSON.parse(run(args, { input: fs.readFileSync(path.join(root, 'tests/platform/snapshot.mjs'), 'utf8') }));
  save(name, data); return data;
}
function compare(before, after, phase) {
  for (const field of ['accounts', 'accountMapHash', 'messages', 'maildirFlags', 'uidValidity', 'queue', 'authSocket']) assert.deepEqual(after[field], before[field], `${phase}: ${field}`);
  let compared = 0;
  for (const [key, value] of Object.entries(before.ownership)) if (after.ownership[key]) { assert.deepEqual(after.ownership[key], value, `${phase}: original ownership`); compared++; }
  for(const key of before.importedKeys||[])assert((after.importedKeys||[]).includes(key),phase+': import ledger entry retained');
  for (const [key, value] of Object.entries(before.webData)) assert.equal(after.webData[key], value, `${phase}: original Webmail file`);
  save(phase + '-preservation', { status: 'success', messages: before.messageCount, accounts: Object.keys(before.accounts).length, queueFiles: Object.keys(before.queue).length, uidValidity: before.uidValidity, ownershipEntriesCompared: compared });
}
async function change(ubuntu, phase) {
  config = structuredClone(original);
  if (ubuntu) {
    for (const [name, service] of Object.entries(config.services)) service.image = candidates[name.replace(/^mailbox-/, '')].imageId;
    config.services['mailbox-webmail-ui'].environment.SMTP_SUBMISSION_PORT = '587';
    config.services['mailbox-webmail-ui'].stop_grace_period='60s';
    config.services['mailbox-webmail-proxy'].stop_grace_period='5m';
  }
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  if (ubuntu && process.env.LEGACY_DRAIN_SCRIPT) {
    const file=path.resolve(process.env.LEGACY_DRAIN_SCRIPT);assert(file.startsWith(root+path.sep));
    run([...compose,'exec','-T','--user','5000:5000','mailbox-webmail-ui','node','--input-type=module'],{input:fs.readFileSync(file,'utf8')});await delay(700);
  }
  command('up', '-d', '--no-build'); await ready();
  log('test.platform.image.changed', { phase, ubuntu });
}
async function validate(phase, ubuntu, password = false) {
  save(phase + '-imap', checkScript('imap-check.mjs', { IMAP_CHECK_PHASE: 'after', EXPECTED_SEEN: 'false' }));
  save(phase + '-smtp', checkScript(ubuntu ? 'standard-listeners.mjs' : 'smtp-check.mjs', { SKIP_DELIVERY: 'true' }));
  save(phase + '-https', checkScript('proxy-check.mjs'));
  save(phase + '-webmail-count',checkScript('webmail-count.mjs',{EXPECTED_WEBMAIL_COUNT:'1'}));
  if (password) save(phase + '-password', checkScript('password-check.mjs'));
  const q = queue(); assert.equal(q.length, 1); assert.equal(q[0].state, 'hold'); save(phase + '-queue', q);
  compare(baseline, snapshot(phase + '-snapshot'), phase);
  log('test.platform.preservation.success', { phase, queue: q.length });
}

await ready();
save('alpine-seen-set',checkScript('imap-check.mjs',{IMAP_CHECK_PHASE:'before'}));
save('alpine-cache-count',checkScript('webmail-count.mjs',{EXPECTED_WEBMAIL_COUNT:'1',REQUESTS:'1'}));
save('alpine-baseline-imap',checkScript('imap-check.mjs',{IMAP_CHECK_PHASE:'before',FLAG_ACTION:'clear',EXPECTED_SEEN:'false'}));
const held = queue(); assert.equal(held.length, 1); assert.equal(held[0].state, 'hold'); save('alpine-baseline-queue', held);
const baseline = snapshot('alpine-baseline-snapshot'); assert.equal(Object.keys(baseline.queue).length, 1);
await change(true, 'ubuntu-first'); await validate('ubuntu-first', true, true);
const ids=command('ps','-q').trim().split(/\s+/);command('stop');const exits=JSON.parse(run(['inspect',...ids])).map(x=>({container:x.Name,exitCode:x.State.ExitCode,oom:x.State.OOMKilled}));save('ubuntu-graceful-stop',exits);for(const x of exits)assert.equal(x.exitCode,0,x.container+' normal exit');command('start');await ready();await validate('ubuntu-restart',true);
await change(false, 'alpine-rollback'); await validate('alpine-rollback', false, true);
await change(true, 'ubuntu-final'); await validate('ubuntu-final', true);
// Release only this isolated held message to its local fixture recipient.
assert(/^[A-Z0-9]+$/.test(held[0].id));
command('exec', '-T', 'mailbox-smtp-receiver', 'postsuper', '-H', held[0].id);
command('exec', '-T', 'mailbox-smtp-receiver', 'postqueue', '-f');
for (let i = 0; i < 30 && queue().length; i++) await delay(1000);
assert.equal(queue().length, 0);
save('ubuntu-local-delivery-webmail',checkScript('webmail-count.mjs',{EXPECTED_WEBMAIL_COUNT:'2'}));
const delivered = snapshot('ubuntu-local-delivery'); assert.equal(delivered.messageCount, baseline.messageCount + 1);
const previousSeen = Object.values(baseline.maildirFlags).filter(x => x.includes('S')).length;
assert.equal(Object.values(delivered.maildirFlags).filter(x => x.includes('S')).length, previousSeen);
save('transition-summary', { status: 'success', phases: ['Alpine baseline', 'Ubuntu', 'Ubuntu restart', 'Alpine rollback', 'Ubuntu final'], baselineMessages: baseline.messageCount, finalMessages: delivered.messageCount, heldQueueSurvived: true, heldMessageDeliveredLocally: true, originalSeenPreserved: previousSeen, productionVolumesUsed: false, externalTestMailSent: false });
log('test.platform.transition.success', { status: 'success' });
