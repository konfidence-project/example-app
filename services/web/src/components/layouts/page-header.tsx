import type { ReactNode } from "react";

import styles from "./app-layout.module.css";

// Title row of a page: a heading, a line under it, and actions on the right.
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageHeading}>
        <h1 className={styles.pageTitle}>{title}</h1>
        {subtitle && <div className={styles.pageSubtitle}>{subtitle}</div>}
      </div>
      {actions && <div className={styles.pageActions}>{actions}</div>}
    </header>
  );
}

export function PageBody({ children }: { children: ReactNode }) {
  return <div className={styles.pageBody}>{children}</div>;
}
