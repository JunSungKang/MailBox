export function safeSegment(value) {
  if (
    typeof value !== "string" ||
    value === "." ||
    value === ".." ||
    !/^[A-Za-z0-9._-]+$/.test(value)
  )
    throw Error("Invalid path segment");
  return value;
}
