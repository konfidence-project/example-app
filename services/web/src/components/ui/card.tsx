import type { ReactNode } from "react";

import styles from "./card.module.css";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={[styles.card, className].filter(Boolean).join(" ")}>{children}</section>
  );
}

export function CardHeader({
  title,
  aside,
  id,
}: {
  title: ReactNode;
  aside?: ReactNode;
  id?: string;
}) {
  return (
    <header className={styles.header}>
      <h2 className={styles.title} id={id}>
        {title}
      </h2>
      {aside}
    </header>
  );
}
