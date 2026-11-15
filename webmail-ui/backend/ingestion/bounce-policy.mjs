export function addressText(value) {
  if (!value) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => item.text || "")
      .filter(Boolean)
      .join(", ");
  }
  return value.text || "";
}
export function headerText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value))
    return value.map(headerText).filter(Boolean).join(", ");
  if (
    typeof value === "object" &&
    "text" in value &&
    typeof value.text === "string"
  ) {
    return value.text;
  }
  return String(value);
}
export function isBounceSource(from, subject, autoSubmitted, contentType) {
  const sourceText =
    `${from}\n${subject}\n${autoSubmitted}\n${contentType}`.toLowerCase();
  return (
    sourceText.includes("mailer-daemon") ||
    sourceText.includes("delivery status") ||
    sourceText.includes("delivery failure") ||
    sourceText.includes("undelivered mail") ||
    sourceText.includes("multipart/report") ||
    sourceText.includes("auto-replied")
  );
}
export function isBounceMeta(meta) {
  return isBounceSource(
    meta.from,
    meta.subject,
    "",
    meta.delivery && !meta.delivery.ok ? "delivery failure" : "",
  );
}
