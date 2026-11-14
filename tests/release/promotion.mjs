import assert from "node:assert/strict";

export function planImmutableTags(tags, existing) {
  const present = tags.filter(tag => existing[tag]);
  const digests = new Set(present.map(tag => existing[tag].digest));
  assert(digests.size <= 1, "Immutable root indexes disagree");
  return {
    existingDigest: present.length ? existing[present[0]].digest : null,
    missing: tags.filter(tag => !existing[tag]),
    preserved: Object.fromEntries(present.map(tag => [tag, existing[tag].digest]))
  };
}

export function assemblyArguments(image, tags, sources) {
  assert(tags.length > 0);
  // License/source/revision/version live on each verified image config. Docker
  // manifest lists do not support OCI index annotations (Buildx0.39 rejects them).
  return ["buildx", "imagetools", "create", ...tags.flatMap(tag => ["--tag", image + ":" + tag]), ...sources];
}
