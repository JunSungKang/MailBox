// Exact image -> OCI manifest -> config digest -> unsuppressed scanner evidence.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const [taskArgument] = process.argv.slice(2);
const root = fs.realpathSync(process.cwd());
const task = fs.realpathSync(path.resolve(taskArgument));
assert(task.startsWith(root + path.sep));
const candidates = JSON.parse(fs.readFileSync(path.join(task, 'reports/candidate-images.json')));
const result = {};
const architecture = process.env.EXPECTED_ARCHITECTURE || "arm64";
assert(["arm64", "amd64"].includes(architecture));
const run = (args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
for (const [name, candidate] of Object.entries(candidates)) {
  const current = JSON.parse(run(['image', 'inspect', candidate.tag]))[0];
  assert.equal(current.Id, candidate.imageId); assert.equal(current.Architecture, architecture);
  const archive = path.join(task, 'images', name + '.tar');
  const tar = (entry) => execFileSync('tar', ['-xOf', archive, entry]);
  function blob(digest) {
    assert(/^sha256:[a-f0-9]{64}$/.test(digest));
    const bytes = tar('blobs/sha256/' + digest.slice(7));
    assert.equal('sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'), digest);
    return JSON.parse(bytes);
  }
  const entries = runTarList();
  function runTarList() { return execFileSync('tar', ['-tf', archive], { encoding: 'utf8' }).split('\n'); }
  let configId, imageConfig;
  if (entries.includes('index.json')) {
    const index = JSON.parse(tar('index.json'));
    const root = index.manifests.find(x => x.digest === candidate.imageId) || (index.manifests.length === 1 ? index.manifests[0] : null);
    assert(root, 'Ambiguous OCI archive root');
    let manifest = blob(root.digest), platformDigest = root.digest;
    if (manifest.manifests) {
      const platform = manifest.manifests.find(x => x.platform?.os === 'linux' && x.platform?.architecture === architecture);
      assert(platform); platformDigest = platform.digest; manifest = blob(platformDigest);
    }
    configId = manifest.config.digest; imageConfig = blob(configId);
    assert([root.digest, platformDigest, configId].includes(candidate.imageId), 'Archive is not bound to the selected image');
  } else {
    const manifests = JSON.parse(tar('manifest.json'));
    const manifest = manifests.find(x => x.RepoTags?.includes(candidate.tag));
    assert(manifest, 'Docker archive tag missing');
    const bytes = tar(manifest.Config);
    configId = 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
    assert.equal(configId, candidate.imageId); imageConfig = JSON.parse(bytes);
  }
  assert.equal(imageConfig.architecture, architecture);
  const scan = JSON.parse(fs.readFileSync(path.join(task, 'reports', name + '.trivy.json')));
  assert.equal(scan.Metadata.ImageID, configId);
  const vulnerabilities = scan.Results.flatMap(x => x.Vulnerabilities || []);
  const counts = {};
  for (const row of vulnerabilities) counts[row.Severity] = (counts[row.Severity] || 0) + 1;
  assert.equal(counts.CRITICAL || 0, 0); assert.equal(counts.HIGH || 0, 0);
  const profile = run(['run', '--rm', '--network', 'none', '--read-only', '--entrypoint', 'sh', candidate.imageId, '-ec',
    '. /etc/os-release; test "$ID" = ubuntu; test "$VERSION_ID" = 26.04; printf "%s\\n" "$PRETTY_NAME"; ' +
    (['smtp-receiver', 'webmail-ui'].includes(name) ? 'node -e \'if(process.versions.node.split(".")[0]!=="24"||typeof require("node:crypto").argon2!=="function")process.exit(1);console.log(process.version)\'; ' : '') +
    (name === 'smtp-receiver' ? 'dpkg-query -W postfix postfix-lmdb; postconf -m | grep -x lmdb;' : name === 'imap-mailbox' ? 'dpkg-query -W dovecot-core dovecot-imapd; dovecot --version;' : name === 'webmail-proxy' ? 'dpkg-query -W nginx;' : 'true')]);
  result[name] = { ...candidate, configId, profile: profile.trim().split('\n'), counts, rawFindings: vulnerabilities.length, uniqueCves: new Set(vulnerabilities.map(x => x.VulnerabilityID)).size, pendingWithoutFixedVersion: vulnerabilities.filter(x => !x.FixedVersion).length };
}
fs.writeFileSync(path.join(task, 'reports/final-image-verification.json'), JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ time: new Date().toISOString(), level: 'INFO', event: 'test.platform.images.verified', status: 'success', images: Object.keys(result).length, high: 0, critical: 0, remainingFindings: Object.values(result).reduce((n, x) => n + x.rawFindings, 0) }));
