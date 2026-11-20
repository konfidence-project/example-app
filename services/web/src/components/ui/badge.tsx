import type { ReactNode } from "react";

import styles from "./badge.module.css";

export type BadgeTone = "neutral" | "info" | "accent";

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}
