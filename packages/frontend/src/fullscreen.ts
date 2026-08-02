/**
 * Fullscreen helpers. Android browsers support the Fullscreen API (and
 * iPadOS via the webkit prefix); iPhone Safari does not — there the app
 * relies on "Add to Home Screen" (see manifest.webmanifest), which this
 * detection treats as already-fullscreen.
 */

type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FsDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

export const fullscreenAvailable = (): boolean => {
  const el = document.documentElement as FsElement;
  const standalone = window.matchMedia(
    "(display-mode: standalone), (display-mode: fullscreen)",
  ).matches;
  return (
    !standalone &&
    (typeof el.requestFullscreen === "function" ||
      typeof el.webkitRequestFullscreen === "function")
  );
};

export const toggleFullscreen = (): void => {
  const doc = document as FsDocument;
  const el = document.documentElement as FsElement;
  const active = doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
  if (active !== null) {
    if (typeof doc.exitFullscreen === "function") {
      void doc.exitFullscreen().catch(() => {});
    } else {
      void doc.webkitExitFullscreen?.();
    }
  } else if (typeof el.requestFullscreen === "function") {
    void el.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
  } else {
    void el.webkitRequestFullscreen?.();
  }
};
