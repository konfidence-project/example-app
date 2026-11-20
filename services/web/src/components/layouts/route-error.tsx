"use client";

import { Button } from "../ui/button";
import { ErrorState } from "../ui/states";

import { PageBody, PageHeader } from "./page-header";

// Shown by the error.tsx files when rendering a page throws.
export function RouteError({
  title,
  error,
  reset,
}: {
  title: string;
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <PageHeader title={title} />
      <PageBody>
        <ErrorState
          title="This page could not be loaded"
          message={
            error.digest
              ? `Something went wrong on the server (reference ${error.digest}).`
              : error.message
          }
          action={<Button onClick={reset}>Try again</Button>}
        />
      </PageBody>
    </>
  );
}
