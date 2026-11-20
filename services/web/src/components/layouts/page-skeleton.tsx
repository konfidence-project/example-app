import { Skeleton } from "../ui/states";

import { PageBody, PageHeader } from "./page-header";

// Shown by the loading.tsx files while a page fetches its data.
export function PageSkeleton({ title, rows = 5 }: { title: string; rows?: number }) {
  return (
    <>
      <PageHeader title={title} subtitle={<Skeleton width={220} height={14} />} />
      <PageBody>
        <Skeleton height={44} width={420} />
        <div
          role="status"
          aria-label="Loading"
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} height={64} />
          ))}
        </div>
      </PageBody>
    </>
  );
}
