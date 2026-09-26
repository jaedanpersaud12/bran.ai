import { useSyncExternalStore } from "react";

/**
 * Whether a media query matches, kept current as it changes.
 *
 * An external store rather than state set in an effect: the browser owns the
 * answer, so React reads it instead of copying it. The server has no viewport
 * to ask, so it answers `false`, and the client catches up on hydration
 * without the markup disagreeing.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
