import crypto from "crypto";

export function normalizeUserId(value) {
  return (value || "").trim().toLowerCase();
}

export function isValidUserId(value) {
  return /^[a-z0-9._-]{1,64}$/.test(value);
}

export function sessionToken(userId, secret) {
  const signature = crypto.createHmac("sha256", secret).update(userId).digest("base64url");
  return `${userId}.${signature}`;
}

export function verifySessionToken(value, secret) {
  const separator = value.lastIndexOf(".");
  if (separator < 1 || !secret) return "";
  const userId = normalizeUserId(value.slice(0, separator));
  const signature = value.slice(separator + 1);
  if (!isValidUserId(userId)) return "";
  const expected = sessionToken(userId, secret).slice(userId.length + 1);
  if (signature.length !== expected.length) return "";
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? userId : "";
}
