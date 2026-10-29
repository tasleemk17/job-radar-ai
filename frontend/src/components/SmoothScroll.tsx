import Lenis from "lenis";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { scrollToTop, setLenis } from "../scroll";

/** Gives the page inertia scrolling. People who asked their system for less motion keep native scrolling. */
export default function SmoothScroll() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({
      lerp: 0.1, // lower is floatier, higher is snappier
      wheelMultiplier: 0.95,
      allowNestedScroll: true, // the drawer, textareas and the board scroll on their own
      autoRaf: true,
    });
    setLenis(lenis);
    return () => {
      lenis.destroy();
      setLenis(null);
    };
  }, []);

  // A new page always starts at the top
  useEffect(() => {
    scrollToTop();
  }, [pathname]);

  return null;
}
