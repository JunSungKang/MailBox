"use client";
import { useEffect, useRef, useState } from "react";
const minFrameHeight = 240,
  maxFrameHeight = 16000;
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
          element.clientHeight,
        ) + 2,
      ),
    ),
  );
}

export function useMailFrameSize(srcDoc: string) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(minFrameHeight);
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;

    let animationFrameId = 0;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let intervalId = 0;
    let timeoutId = 0;
    const imageListeners: Array<() => void> = [];

    const resize = () => {
      const document = frame.contentDocument;
      if (!document) return;

      const nextHeight = measuredHeight(document);
      setHeight((currentHeight) =>
        currentHeight === nextHeight ? currentHeight : nextHeight,
      );
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
          subtree: true,
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

      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
      intervalId = window.setInterval(scheduleResize, 500);
      timeoutId = window.setTimeout(() => {
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
      window.clearTimeout(timeoutId);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      imageListeners.splice(0).forEach((removeListener) => removeListener());
    };
  }, [srcDoc]);

  return { frameRef, height };
}
