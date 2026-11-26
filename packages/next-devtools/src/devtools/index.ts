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
import { type ReactElement, createElement } from "react";

import { devtoolsEnabled } from "./hops.js";
import { DevtoolsLoader, type Position } from "./loader.js";

export const DEFAULT_ENDPOINT = "/api/konfidence/devtools" as const;

export interface KonfidenceDevtoolsProps {
  /** Path of the data endpoint. Default /api/konfidence/devtools. */
  endpoint?: string;
  /** Corner of the closed button. Default bottom-right. */
  position?: Position;
}

/** Renders nothing unless KONFIDENCE_DEVTOOLS is 1 or true on the server. */
export function KonfidenceDevtools({
  endpoint = DEFAULT_ENDPOINT,
  position = "bottom-right",
}: KonfidenceDevtoolsProps = {}): ReactElement | null {
  if (!devtoolsEnabled()) return null;
  return createElement(DevtoolsLoader, { endpoint, position });
}
