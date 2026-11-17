import { invalidateAll } from "$app/navigation";

// backgroundRefresh re-runs the page's server load on an interval while the tab is visible, so lists pick up changes
// made elsewhere. Every refresh is a fresh round of east-west calls from web.
export function backgroundRefresh(ms: number, enabled: () => boolean = () => true): void {
  $effect(() => {
    if (!enabled()) return;
    const id = setInterval(() => {
      if (!document.hidden) invalidateAll();
    }, ms);
    return () => clearInterval(id);
  });
}
