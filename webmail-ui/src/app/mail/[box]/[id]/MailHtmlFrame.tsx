"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type MailHtmlFrameProps = {
  html: string;
  title: string;
};

const minFrameHeight = 240;
const maxFrameHeight = 16000;

function framePreamble(): string {
  return [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<base target="_blank">',
    "<style>html,body{margin:0;padding:0;background:transparent;}</style>"
  ].join("");
}

function buildFrameDocument(html: string): string {
  const preamble = framePreamble();
  if (/<html[\s>]/i.test(html)) {
    if (/<head[\s>]/i.test(html)) {
      return html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}${preamble}`);
    }
    return html.replace(/<html(\s[^>]*)?>/i, (match) => `${match}<head>${preamble}</head>`);
  }

  return `<!doctype html><html><head>${preamble}</head><body>${html}</body></html>`;
}

function measuredHeight(document: Document): number {
  const body = document.body;
  const element = document.documentElement;
  return Math.min(
    maxFrameHeight,
    Math.max(
      minFrameHeight,
      Math.ceil(
        Math.max(
          body?.scrollHeight || 0,
          body?.offsetHeight || 0,
          element.scrollHeight,
          element.offsetHeight,
          element.clientHeight
        ) + 2
      )
    )
  );
}

export default function MailHtmlFrame({ html, title }: MailHtmlFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(minFrameHeight);
  const srcDoc = useMemo(() => buildFrameDocument(html), [html]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;

    let animationFrameId = 0;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let intervalId = 0;
    const imageListeners: Array<() => void> = [];

    const resize = () => {
      const document = frame.contentDocument;
      if (!document) return;

      const nextHeight = measuredHeight(document);
      setHeight((currentHeight) => (currentHeight === nextHeight ? currentHeight : nextHeight));
    };

    const scheduleResize = () => {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(resize);
    };

    const bindFrameContent = () => {
      const document = frame.contentDocument;
      if (!document) return;

      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      imageListeners.splice(0).forEach((removeListener) => removeListener());

      scheduleResize();

      Array.from(document.links).forEach((link) => {
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
      });

      if ("ResizeObserver" in window) {
        resizeObserver = new ResizeObserver(scheduleResize);
        resizeObserver.observe(document.documentElement);
        if (document.body) {
          resizeObserver.observe(document.body);
        }
      }

      if ("MutationObserver" in window && document.body) {
        mutationObserver = new MutationObserver(scheduleResize);
        mutationObserver.observe(document.body, {
          attributes: true,
          characterData: true,
          childList: true,
          subtree: true
        });
      }

      Array.from(document.images).forEach((image) => {
        const onImageChange = () => scheduleResize();
        image.addEventListener("load", onImageChange);
        image.addEventListener("error", onImageChange);
        imageListeners.push(() => {
          image.removeEventListener("load", onImageChange);
          image.removeEventListener("error", onImageChange);
        });
      });

      intervalId = window.setInterval(scheduleResize, 500);
      window.setTimeout(() => {
        window.clearInterval(intervalId);
      }, 5000);
    };

    setHeight(minFrameHeight);
    frame.addEventListener("load", bindFrameContent);
    bindFrameContent();

    return () => {
      frame.removeEventListener("load", bindFrameContent);
      window.cancelAnimationFrame(animationFrameId);
      window.clearInterval(intervalId);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      imageListeners.splice(0).forEach((removeListener) => removeListener());
    };
  }, [srcDoc]);

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
