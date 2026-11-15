export function redirect(res, location) {
  res.writeHead(303, { Location: location });
  res.end();
}

export function sendText(res, status, message) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(message);
}
