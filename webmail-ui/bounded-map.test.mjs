import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { boundedMap } from './src/lib/boundedMap.ts';

test('metadata work stays bounded and preserves input order', async () => {
  let active = 0, peak = 0;
  const result = await boundedMap(Array.from({length: 40}, (_, i) => i), 4, async i => {
    peak = Math.max(peak, ++active); await delay(i % 3); active--; return i * 2;
  });
  assert.equal(peak, 4); assert.equal(active, 0);
  assert.deepEqual(result, Array.from({length: 40}, (_, i) => i * 2));
});
test('failure stops dispatch and waits for in-flight cleanup', async () => {
  const failure = new Error('fixture'); let active = 0, dispatched = 0;
  await assert.rejects(boundedMap(Array.from({length: 100}, (_, i) => i), 3, async i => {
    active++; dispatched++;
    try { if (i === 0) throw failure; await delay(10); } finally { active--; }
  }), error => error === failure);
  assert.equal(active, 0); assert(dispatched >= 1 && dispatched <= 3);
});
test('empty inputs and invalid concurrency are explicit', async () => {
  assert.deepEqual(await boundedMap([], 4, async x => x), []);
  for (const n of [0, -1, 1.5, NaN]) await assert.rejects(boundedMap([1], n, async x => x), RangeError);
});
