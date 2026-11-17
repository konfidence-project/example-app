import Link from "next/link";

import styles from "./segmented-control.module.css";

export interface Segment {
  label: string;
  href: string;
  active: boolean;
}

// A row of mutually exclusive links, for filters kept in the URL.
export function SegmentedControl({ label, segments }: { label: string; segments: Segment[] }) {
  return (
    <nav aria-label={label} className={styles.group}>
      {segments.map((segment) => (
        <Link
          key={segment.href}
          href={segment.href}
          className={segment.active ? `${styles.segment} ${styles.active}` : styles.segment}
          aria-current={segment.active ? "page" : undefined}
          scroll={false}
        >
          {segment.label}
        </Link>
      ))}
    </nav>
  );
}
