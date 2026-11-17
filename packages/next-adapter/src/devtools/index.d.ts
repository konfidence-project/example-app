import type { ReactElement } from "react";

export const DEFAULT_ENDPOINT: "/api/konfidence/devtools";

export interface KonfidenceDevtoolsProps {
  /** Path of the data endpoint. Default /api/konfidence/devtools. */
  endpoint?: string;
  /** Corner of the closed button. Default bottom-right. */
  position?: "bottom-right" | "bottom-left";
}

/** Renders nothing unless KONFIDENCE_DEVTOOLS is 1 or true on the server. */
export function KonfidenceDevtools(props?: KonfidenceDevtoolsProps): ReactElement | null;
