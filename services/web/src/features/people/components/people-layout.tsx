import Link from "next/link";
import type { ReactNode } from "react";

import { paths } from "@/config/paths";

import styles from "./people.module.css";

export function CandidateBreadcrumb({ name }: { name: string }) {
  return (
    <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
      <ol>
        <li>
          <Link href={paths.people.href}>People</Link>
        </li>
        <li aria-current="page">{name}</li>
      </ol>
    </nav>
  );
}

export function PeopleToolbar({ children }: { children: ReactNode }) {
  return (
    <div className={styles.toolbar}>
      {children}
      <span className={styles.sorted}>Sorted by next interview</span>
    </div>
  );
}

export function CandidateDetailLayout({ main, aside }: { main: ReactNode; aside: ReactNode }) {
  return (
    <div className={styles.detail}>
      <div className={styles.column}>{main}</div>
      <div className={styles.column}>{aside}</div>
    </div>
  );
}
