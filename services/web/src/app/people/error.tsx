"use client";

import { RouteError } from "@/components/layouts/route-error";

export default function PeopleError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError title="People" {...props} />;
}
