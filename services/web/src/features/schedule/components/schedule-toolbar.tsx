import { ButtonLink } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { paths } from "@/config/paths";
import type { InterviewType } from "@/types/api";
import { TYPE_LABEL } from "@/utils/interview";
import { formatWeekRange, type DateKey } from "@/utils/time";

import type { TypeFilter } from "../types";
import { nextWeek, previousWeek } from "../utils/week";

import styles from "./schedule.module.css";

export function ScheduleToolbar({
  week,
  thisWeek,
  type,
  offered,
}: {
  week: DateKey;
  thisWeek: DateKey;
  type: TypeFilter;
  offered: InterviewType[];
}) {
  const filters: TypeFilter[] = ["all", ...offered];
  return (
    <div className={styles.toolbar}>
      <SegmentedControl
        label="Interview type"
        segments={filters.map((filter) => ({
          label: filter === "all" ? "All" : TYPE_LABEL[filter],
          href: paths.schedule.getHref({
            week: week === thisWeek ? undefined : week,
            type: filter,
          }),
          active: filter === type,
        }))}
      />
      <nav className={styles.pager} aria-label="Week">
        <ButtonLink
          size="icon"
          href={paths.schedule.getHref({ week: previousWeek(week), type })}
          aria-label="Previous week"
          scroll={false}
        >
          <ChevronLeftIcon />
        </ButtonLink>
        <span className={styles.range} aria-live="polite">
          {formatWeekRange(week)}
        </span>
        <ButtonLink
          size="icon"
          href={paths.schedule.getHref({ week: nextWeek(week), type })}
          aria-label="Next week"
          scroll={false}
        >
          <ChevronRightIcon />
        </ButtonLink>
        <ButtonLink
          href={paths.schedule.getHref({ type })}
          aria-current={week === thisWeek ? "page" : undefined}
          scroll={false}
        >
          Today
        </ButtonLink>
      </nav>
    </div>
  );
}
