// Run only inside an isolated production-image fixture, never against real accounts.
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { parseDovecotUsers } from "/app/account-core.mjs";
import { verifySessionToken } from "/app/auth-core.mjs";

assert.equal(process.env.MAILBOX_SIGNUP_FIXTURE, "true");
assert.equal(process.env.MAIL_DOMAINS, "signup.fixture.invalid");
assert.equal(process.env.WEBMAIL_SIGNUP_TOKEN, undefined);
const restart = process.argv.includes("--restart");
const checks = [];
const check = (name, value) => { assert(value, name); checks.push(name); };
const usersPath = "/accounts/dovecot-users";
const recipientsPath = "/accounts/virtual-mailbox-accounts";
const post = (route, userId, password) => fetch("http://127.0.0.1:3000/api/auth/" + route, {
  method: "POST", redirect: "manual", body: new URLSearchParams({ userId, password })
});
const rejected = (response, location) => response.status === 303 &&
  response.headers.get("location") === location && !response.headers.has("set-cookie");
const initialUsers = fs.readFileSync(usersPath, "utf8");
const initialRecipients = fs.readFileSync(recipientsPath, "utf8");
const legacy = fs.readFileSync("/app/data/users.json", "utf8");
const page = await fetch("http://127.0.0.1:3000/signup");
const html = await page.text();
check("signup form contains only ID/password credentials", page.status === 200 &&
  /name="userId"/.test(html) && /name="password"/.test(html) && !/signupToken|가입 코드/.test(html));

if (!restart) {
  for (const [id, password, error] of [
    ["reject-short", "a".repeat(7), "weak_password"],
    ["reject-long", "a".repeat(129), "weak_password"],
    ["reject-nul", "synthetic\0password", "weak_password"],
    ["..", "synthetic-password", "invalid"]
  ]) check("invalid credentials rejected without a session", rejected(await post("signup", id, password), "/signup?error=" + error));
  check("invalid signup leaves both account files unchanged", fs.readFileSync(usersPath, "utf8") === initialUsers &&
    fs.readFileSync(recipientsPath, "utf8") === initialRecipients);
  check("legacy ID cannot be claimed with a new password", rejected(await post("signup", "legacy-owner", crypto.randomBytes(32).toString("base64url")), "/signup?error=exists"));
  check("failed legacy ownership check leaves account files unchanged", fs.readFileSync(usersPath, "utf8") === initialUsers &&
    fs.readFileSync(recipientsPath, "utf8") === initialRecipients);
  for (const [id, password] of [["public-eight", "a".repeat(8)], ["public-unicode", "가".repeat(128)], ["legacy-owner", process.env.FIXTURE_LEGACY_PASSWORD]]) {
    const signup = await post("signup", id, password);
    const cookie = signup.headers.get("set-cookie") || "";
    check("signup succeeds without any invite field", signup.status === 303 && signup.headers.get("location") === "/inbox");
    check("signup issues the existing secure signed session", /; Secure/i.test(cookie) && /; HttpOnly/i.test(cookie) &&
      /; SameSite=Lax/i.test(cookie) && verifySessionToken(decodeURIComponent(cookie.split(";")[0].slice("mailbox_user=".length)), process.env.WEBMAIL_SESSION_SECRET) === id);
  }
}
for (const [id, password] of [["public-eight", "a".repeat(8)], ["public-unicode", "가".repeat(128)],
  ["legacy-owner", process.env.FIXTURE_LEGACY_PASSWORD], ["existing-owner", process.env.FIXTURE_EXISTING_PASSWORD]]) {
  check("full-password login works" + (restart ? " after restart" : ""), (await post("login", id, password)).headers.get("location") === "/inbox");
  check("wrong password remains rejected", rejected(await post("login", id, password.slice(0, -1) + (password.endsWith("Z") ? "Y" : "Z")), "/login?error=invalid_credentials"));
}
const beforeDuplicate = fs.readFileSync(usersPath, "utf8");
const mapBeforeDuplicate = fs.readFileSync(recipientsPath, "utf8");
check("duplicate signup cannot reset an account", rejected(await post("signup", "public-eight", crypto.randomBytes(32).toString("base64url")), "/signup?error=exists"));
check("duplicate leaves original hashes and recipient map unchanged", fs.readFileSync(usersPath, "utf8") === beforeDuplicate &&
  fs.readFileSync(recipientsPath, "utf8") === mapBeforeDuplicate);
for (const line of initialUsers.split("\n").filter(line => line && !line.startsWith("#"))) {
  check("pre-existing account hash is preserved", beforeDuplicate.split("\n").includes(line));
}
check("legacy source remains unchanged", fs.readFileSync("/app/data/users.json", "utf8") === legacy);
const accounts = parseDovecotUsers(beforeDuplicate);
check("new accounts use Argon2id", accounts.filter(a => a.id.startsWith("public-")).length === 2 &&
  accounts.filter(a => a.id.startsWith("public-")).every(a => a.passwordHash.startsWith("{ARGON2ID}")));
check("all fixture accounts retain local delivery addresses", ["public-eight", "public-unicode", "legacy-owner", "existing-owner"]
  .every(id => mapBeforeDuplicate.includes(`${id}@signup.fixture.invalid ${id}/Maildir/`)));
console.log(JSON.stringify({ time: new Date().toISOString(), level: "INFO", event: "test.signup.public", status: "success", restart, passed: checks.length, checks }));
