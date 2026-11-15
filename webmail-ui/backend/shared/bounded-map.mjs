// Await in-flight work even on failure; callers can safely clean up afterwards.
export async function boundedMap(values, concurrency, map) {
  if (!Number.isInteger(concurrency) || concurrency < 1)
    throw new RangeError("Invalid concurrency");
  const results = new Array(values.length);
  let next = 0;
  let failed = false;
  let failure;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (!failed) {
        const index = next++;
        if (index >= values.length) return;
        try {
          results[index] = await map(values[index], index);
        } catch (error) {
          if (!failed) failure = error;
          failed = true;
        }
      }
    }),
  );
  if (failed) throw failure;
  return results;
}
