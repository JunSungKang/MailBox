function framePreamble(): string {
  return [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<base target="_blank">',
    "<style>html,body{margin:0;padding:0;background:transparent;}</style>",
  ].join("");
}

export function buildFrameDocument(html: string): string {
  const preamble = framePreamble();
  if (/<html[\s>]/i.test(html)) {
    if (/<head[\s>]/i.test(html)) {
      return html.replace(
        /<head(\s[^>]*)?>/i,
        (match) => `${match}${preamble}`,
      );
    }
    return html.replace(
      /<html(\s[^>]*)?>/i,
      (match) => `${match}<head>${preamble}</head>`,
    );
  }

  return `<!doctype html><html><head>${preamble}</head><body>${html}</body></html>`;
}
