import fs from "node:fs";
import assert from "node:assert/strict";

// Called only with the disposable smoke fixture's exact handles and names.
export async function verifyRegression({
  root,
  directory,
  prefix,
  fixture,
  compose,
  exec,
  docker,
  env,
  images,
}) {
  assert.match(prefix, /^mailbox-package-fixture-[a-f0-9]{16}$/);
  const save = (name, value) =>
    fs.writeFileSync(
      directory + "/reports/" + name + ".json",
      JSON.stringify(value, null, 2) + "\n",
    );
  const ready = () =>
    exec(
      "node",
      "--input-type=module",
      "-e",
      `for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:3000/signup')).status===200)process.exit(0);}catch{}await new Promise(r=>setTimeout(r,300));}process.exit(1);`,
    );
  const snapshot = () =>
    JSON.parse(
      docker([
        "run",
        "--rm",
        "--read-only",
        "--network",
        "none",
        "--entrypoint",
        "node",
        "--mount",
        `type=bind,src=${root}/tests/performance/data-snapshot.mjs,dst=/check.mjs,readonly`,
        ...Object.entries({
          mail: "mailboxes",
          accounts: "accounts",
          queue: "queue",
          data: "webdata",
          auth: "auth",
        }).flatMap(([key, target]) => [
          "--mount",
          `type=volume,src=${prefix}-${key},dst=/${target},readonly`,
        ]),
        images.web,
        "/check.mjs",
      ]),
    );
  // A real held queue file survives the web replacement and remains undelivered.
  compose(
    "exec",
    "-T",
    "smtp",
    "sh",
    "-ec",
    "printf '/^X-Platform-Hold:/ HOLD isolated fixture\n' > /etc/postfix/fixture-header-checks; postconf -e 'header_checks = regexp:/etc/postfix/fixture-header-checks'; postfix reload",
  );
  exec("node", "/checks/hold-mail.mjs");
  let held = [];
  for (let i = 0; i < 30; i++) {
    held = compose("exec", "-T", "smtp", "postqueue", "-j")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(JSON.parse)
      .filter((item) => item.queue_name === "hold");
    if (held.length) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(held.length, 1);
  const before = snapshot();
  assert.equal(Object.keys(before.queue).length, 1);
  const benchmark = () =>
    JSON.parse(
      exec(
        "node",
        "--input-type=module",
        "-e",
        `
    import fs from 'node:fs';
    const login=await fetch('http://127.0.0.1:3000/api/auth/login',{method:'POST',redirect:'manual',body:new URLSearchParams({userId:'fixture-user',password:process.env.FIXTURE_PASSWORD})});
    const cookie=login.headers.get('set-cookie').split(';')[0],samples=[];
    for(let i=0;i<65;i++){const start=performance.now();const r=await fetch('http://127.0.0.1:3000/inbox',{headers:{Cookie:cookie}});if(r.status!==200)throw Error('Benchmark request failed');await r.text();if(i>=5)samples.push(performance.now()-start);}
    samples.sort((a,b)=>a-b);console.log(JSON.stringify({requests:samples.length,medianMs:samples[30],p95Ms:samples[57],memory:fs.readFileSync('/proc/1/status','utf8').split('\\n').filter(line=>/^Vm(HWM|RSS):/.test(line))}));
  `,
      ),
    );
  const compare = (phase) => {
    const after = snapshot();
    for (const key of [
      "accounts",
      "accountEntries",
      "messages",
      "uidValidity",
      "uidMappings",
      "maildirFlags",
      "queue",
      "webData",
      "importedKeys",
    ])
      assert.deepEqual(after[key], before[key], phase + ":" + key);
    save("preservation-" + phase, {
      status: "success",
      messageCount: after.messageCount,
      queueFiles: Object.keys(after.queue).length,
      accountCount: Object.keys(after.accounts).length,
    });
  };
  compose("restart", "--timeout", "60", "web");
  ready();
  const candidate = [];
  for (let i = 0; i < 3; i++) candidate.push(benchmark());
  save("performance-candidate", candidate);
  const configPath = fixture + "/compose.json",
    config = JSON.parse(fs.readFileSync(configPath));
  const replace = (image) => {
    compose("stop", "--timeout", "60", "web");
    config.services.web.image = image;
    fs.writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });
    compose("up", "-d", "--no-deps", "--pull", "never", "--no-build", "web");
    ready();
  };
  const baselineImage = process.env.MAILBOX_BASELINE_WEB_IMAGE;
  if (!baselineImage)
    throw Error("MAILBOX_BASELINE_WEB_IMAGE required for regression");
  replace(baselineImage);
  compare("rollback");
  const baseline = [];
  for (let i = 0; i < 3; i++) baseline.push(benchmark());
  save("performance-baseline", baseline);
  replace(images.web);
  compare("candidate-return");
  compose("restart", "--timeout", "60", "web");
  ready();
  compare("candidate-restart");
  save("regression-summary", {
    status: "success",
    baselineImage,
    candidateImage: images.web,
    heldQueuePreserved: true,
    oldImageReadCompatible: true,
    productionDataUsed: false,
    externalRealMailSent: false,
  });
}
