"use client";
// Loads the devtools widget after hydration and mounts it outside the app's
// DOM tree. The dynamic import keeps the widget in its own chunk.
import { useEffect } from "react";

export function DevtoolsLoader({ endpoint, position }) {
  useEffect(() => {
    let unmount = null;
    let cancelled = false;
    import("./panel.js")
      .then(({ mountDevtools }) => {
        if (!cancelled) unmount = mountDevtools({ endpoint, position });
      })
      .catch((err) => console.warn("konfidence devtools failed to load", err));
    return () => {
      cancelled = true;
      unmount?.();
    };
  }, [endpoint, position]);
  return null;
}
