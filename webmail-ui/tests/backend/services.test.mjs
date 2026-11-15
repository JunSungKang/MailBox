import { test } from "node:test";
import assert from "node:assert/strict";
import { safeSegment } from "../../backend/shared/safe-path.mjs";
import { messageBelongsToUser } from "../../backend/domain/mail-access.mjs";
import { createMailboxService } from "../../backend/application/mailbox.mjs";
import { createSendMail } from "../../backend/application/send-mail.mjs";
import { createRegisterAccount } from "../../backend/application/register-account.mjs";

test("all mailbox services authorize before exposing message data", async () => {
  const own = {
    id: "one",
    box: "inbox",
    to: ["One <one@fixture.test>"],
    from: "other@fixture.test",
  };
  const other = { ...own, id: "two", to: ["two@fixture.test"] };
  const service = createMailboxService({
    repository: {
      ensureMailDirs: async () => {},
      listStoredMessages: async () => [own, other],
      readMessage: async () => other,
    },
  });
  assert.deepEqual(await service.listMailbox({ actor: "one", box: "inbox" }), [
    own,
  ]);
  assert.equal(
    await service.getMessage({ actor: "one", box: "inbox", id: "two" }),
    null,
  );
  assert.deepEqual(await service.listMailbox({ actor: "", box: "inbox" }), []);
  assert.equal(
    messageBelongsToUser({ box: "sent", from: "one@fixture.test" }, "one"),
    true,
  );
  assert.equal(messageBelongsToUser({ box: "inbox", to: null }, "one"), false);
});
test("dot segments and encoded traversal cannot become storage components", () => {
  for (const value of [".", "..", "../one", "%2e%2e", "a/b", "a\\b", ""])
    assert.throws(() => safeSegment(value));
  assert.equal(safeSegment("one-2.3_4"), "one-2.3_4");
});
test("SMTP acceptance followed by persistence failure never triggers a second submission", async () => {
  let submissions = 0;
  const events = [];
  const send = createSendMail({
    domain: "fixture.test",
    repository: {
      stage: async () => [],
      persist: async () => {
        throw Error("disk failure");
      },
    },
    transport: {
      sendMail: async () => {
        submissions++;
      },
    },
    audit: (...args) => events.push(args),
  });
  await assert.rejects(
    send({
      actor: "one",
      fields: { to: "two", from: "forged@fixture.test", body: "fixture" },
      uploaded: [],
    }),
    /disk failure/,
  );
  assert.equal(submissions, 1);
  assert.equal(events.at(-1)[2].deliveryAccepted, true);
});
test("SMTP failure persists a safe failed delivery and fixes sender from actor", async () => {
  let saved, submitted;
  const send = createSendMail({
    domain: "fixture.test",
    repository: {
      stage: async () => [],
      persist: async (value) => {
        saved = value;
      },
    },
    transport: {
      sendMail: async (mail) => {
        submitted = mail;
        throw Object.assign(Error("sensitive-response-marker"), {
          code: "ETLS",
        });
      },
    },
    audit: () => {},
  });
  await send({
    actor: "one",
    fields: { to: "two", from: "forged@fixture.test", body: "fixture" },
    uploaded: [],
  });
  assert.equal(saved.from, "one@fixture.test");
  assert.equal(submitted.from, saved.from);
  assert.equal(saved.delivery.ok, false);
  assert(!JSON.stringify(saved).includes("sensitive-response-marker"));
});
test("service signup never trusts an asserted forwarded peer", async () => {
  let calls = 0;
  const register = createRegisterAccount({
    accountStore: {
      provision: async () => {
        calls++;
      },
    },
    serviceUser: "submit",
    servicePassword: "a".repeat(40),
  });
  await assert.rejects(
    register({
      userId: "submit",
      password: "a".repeat(40),
      remoteAddress: "172.20.0.3",
    }),
    { code: "ACCOUNT_EXISTS" },
  );
  assert.equal(calls, 0);
  await register({
    userId: "submit",
    password: "a".repeat(40),
    remoteAddress: "127.0.0.1",
  });
  assert.equal(calls, 1);
});

test("audit error records cannot copy raw credential markers", async () => {
  const { auditError } = await import("../../backend/shared/audit-logger.mjs");
  const original = console.error;
  let line;
  try {
    console.error = (value) => {
      line = value;
    };
    auditError("fixture.failure", {
      error: Object.assign(Error("secret-marker-cookie"), { code: "ESOCKET" }),
    });
  } finally {
    console.error = original;
  }
  assert(!line.includes("secret-marker"));
  assert.equal(JSON.parse(line).error.code, "ESOCKET");
});
