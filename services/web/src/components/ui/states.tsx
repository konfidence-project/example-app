import type { ReactNode } from "react";

import styles from "./states.module.css";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <p className={styles.title}>{title}</p>
      {children && <div className={styles.text}>{children}</div>}
    </div>
  );
}

export function ErrorState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className={`${styles.empty} ${styles.error}`} role="alert">
      <p className={styles.title}>{title}</p>
      {message && <p className={styles.text}>{message}</p>}
      {action}
    </div>
  );
}

export function Skeleton({
  height = 16,
  width = "100%",
}: {
  height?: number;
  width?: number | string;
}) {
  return <span className={styles.skeleton} style={{ height, width }} aria-hidden="true" />;
}
