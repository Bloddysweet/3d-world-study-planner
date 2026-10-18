import { useSyncExternalStore } from "react";
import { isCompactWorld } from "../domain/world-motion";

// Phones in either orientation; do not downgrade normal desktop/tablet views.
const query = "(max-width: 699px), (pointer: coarse) and (max-height: 499px)";
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
export function useCompactWorld() {
  return useSyncExternalStore(
    subscribe,
    () =>
      isCompactWorld(
        window.innerWidth,
        window.innerHeight,
        window.matchMedia("(pointer: coarse)").matches,
      ),
    () => true,
  );
}
