import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalMaildirKey as identity } from './src/lib/maildirIdentity.ts';

test('new/cur moves and Seen flag renames retain one message identity', () => {
  for (const key of ['/mailboxes/alice/Maildir:new/123.unique', '/mailboxes/alice/Maildir:cur/123.unique:2,', '/mailboxes/alice/Maildir:cur/123.unique:2,RS']) {
    assert.equal(identity(key), '/mailboxes/alice/Maildir:message/123.unique');
  }
});
test('different messages and different mailbox roots never collapse', () => {
  assert.notEqual(identity('/mailboxes/alice/Maildir:new/one'), identity('/mailboxes/alice/Maildir:new/two'));
  assert.notEqual(identity('/mailboxes/alice/Maildir:new/one'), identity('/mailboxes/bob/Maildir:new/one'));
});
test('legacy ledger entries recognize the current filename without conversion', () => {
  const raw = ['/mailboxes/alice/Maildir:new/123.unique', 'operator-preserved-entry'];
  const known = new Set(raw.map(identity));
  assert(known.has(identity('/mailboxes/alice/Maildir:cur/123.unique:2,S')));
  assert.deepEqual(raw, ['/mailboxes/alice/Maildir:new/123.unique', 'operator-preserved-entry']);
});
test('unrecognized and empty-name ledger entries remain untouched', () => {
  for (const key of ['', 'operator-preserved-entry', '/root:other/one', '/root:new/:2,S', '/root:new/folder/one']) assert.equal(identity(key), key);
});
test('ordinary colons in the unique filename are preserved', () => {
  assert.equal(identity('/root:cur/a:b:2,S'), '/root:message/a:b');
  assert.notEqual(identity('/root:cur/a:b:2,S'), identity('/root:cur/a:2,S'));
});
