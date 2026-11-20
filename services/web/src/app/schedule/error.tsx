"use client";

import { RouteError } from "@/components/layouts/route-error";

export default function ScheduleError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError title="Schedule" {...props} />;
}
