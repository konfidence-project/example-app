import { initials } from "@/utils/format";

import styles from "./avatar.module.css";

export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span className={`${styles.avatar} ${styles[size]}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
