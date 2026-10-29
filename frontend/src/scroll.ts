import type Lenis from "lenis";

// The smooth-scroll engine lives in SmoothScroll.tsx. Other parts of the app reach it through here.
let instance: Lenis | null = null;

export function setLenis(lenis: Lenis | null) {
  instance = lenis;
}

/** Freezes the page behind a drawer or dialog. Scrolling inside the drawer itself keeps working. */
export function lockScroll(locked: boolean) {
  document.body.style.overflow = locked ? "hidden" : "";
  if (locked) instance?.stop();
  else instance?.start();
}

export function scrollToTop() {
  if (instance) instance.scrollTo(0, { immediate: true });
  else window.scrollTo(0, 0);
}
