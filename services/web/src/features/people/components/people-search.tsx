"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { SearchIcon } from "@/components/ui/icons";

import styles from "./people.module.css";

// Search box that keeps its value in ?q=, so the server renders the result
// and the URL can be shared.
export function PeopleSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function search(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const q = next.trim();
      startTransition(() =>
        router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname, { scroll: false }),
      );
    }, 250);
  }

  return (
    <div className={styles.search} role="search">
      <SearchIcon className={styles.searchIcon} />
      <label htmlFor="people-search" className="visually-hidden">
        Search by name or email
      </label>
      <input
        id="people-search"
        type="search"
        className={styles.searchInput}
        placeholder="Search by name or email"
        value={value}
        onChange={(event) => search(event.target.value)}
        autoComplete="off"
        aria-busy={pending}
      />
    </div>
  );
}
