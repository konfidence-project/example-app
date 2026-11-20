"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { paths } from "@/config/paths";

import { CalendarIcon, PeopleIcon } from "../ui/icons";

import { Logo } from "./logo";
import styles from "./app-layout.module.css";

const NAV: { label: string; href: string; icon: ReactNode }[] = [
  { label: "Schedule", href: paths.schedule.href, icon: <CalendarIcon /> },
  { label: "People", href: paths.people.href, icon: <PeopleIcon /> },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className={styles.sidebar}>
      <Link href={paths.home.href} className={styles.logo}>
        <Logo />
      </Link>
      <nav aria-labelledby="nav-workspace">
        <p id="nav-workspace" className={styles.section}>
          Workspace
        </p>
        <ul className={styles.nav}>
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={active ? `${styles.navItem} ${styles.active}` : styles.navItem}
                  aria-current={active ? "page" : undefined}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
