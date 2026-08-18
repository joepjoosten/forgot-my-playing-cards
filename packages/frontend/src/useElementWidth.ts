import { useRef, useState } from "react";

/**
 * An element's width as state, kept current by a ResizeObserver — so a
 * rotation (or split view, or the keyboard) re-renders layouts that are
 * computed from the width. Attach the returned callback as the element's
 * ref; `width` is 0 while nothing is attached.
 */
export const useElementWidth = () => {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [width, setWidth] = useState(0);

  const attach = (el: HTMLDivElement | null) => {
    elementRef.current = el;
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (el !== null) {
      const observer = new ResizeObserver(() => setWidth(el.clientWidth));
      observer.observe(el);
      observerRef.current = observer;
      setWidth(el.clientWidth);
    }
  };

  return { attach, width, elementRef };
};
