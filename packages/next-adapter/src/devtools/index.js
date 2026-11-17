// <KonfidenceDevtools />: a floating widget that shows how the current
// request travelled through the vector. Put it once into the root layout.
//
// It renders nothing unless KONFIDENCE_DEVTOOLS is 1 or true on the server.
// When it is on, the browser loads a small loader, and the loader imports the
// widget code only after the page has started. The widget mounts in its own
// shadow root and its own React root, so it shares no styles and no state with
// the app.
//
// This file is a server component on purpose: the env check happens on the
// server, so a page without devtools ships none of their code.
import { createElement } from "react";
import { devtoolsEnabled } from "./hops.js";
import { DevtoolsLoader } from "./loader.js";

export const DEFAULT_ENDPOINT = "/api/konfidence/devtools";

/** @param {{ endpoint?: string, position?: "bottom-right" | "bottom-left" }} props */
export function KonfidenceDevtools({
  endpoint = DEFAULT_ENDPOINT,
  position = "bottom-right",
} = {}) {
  if (!devtoolsEnabled()) return null;
  return createElement(DevtoolsLoader, { endpoint, position });
}
