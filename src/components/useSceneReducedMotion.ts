import { useSyncExternalStore } from "react";

// The installed Motion hook snapshots this preference at mount. A background
// character loop must also stop immediately if the OS preference changes live.
const query = "(prefers-reduced-motion: reduce)";
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const snapshot = () => window.matchMedia(query).matches;
export function useSceneReducedMotion() {
  return useSyncExternalStore(subscribe, snapshot, () => true);
}
