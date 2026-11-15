"use client";
import { useMemo } from "react";
import { buildFrameDocument } from "../model/frame-document";
import { useMailFrameSize } from "../hooks/useMailFrameSize";
export default function MailHtmlFrame({
  html,
  title,
}: {
  html: string;
  title: string;
}) {
  const srcDoc = useMemo(() => buildFrameDocument(html), [html]);
  const { frameRef, height } = useMailFrameSize(srcDoc);
  return (
    <iframe
      className="messageHtmlFrame"
      ref={frameRef}
      referrerPolicy="no-referrer"
      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      srcDoc={srcDoc}
      style={{ height }}
      title={title}
    />
  );
}
