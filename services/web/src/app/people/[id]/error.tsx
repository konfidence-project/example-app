"use client";

import { RouteError } from "@/components/layouts/route-error";

export default function CandidateError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError title="Candidate" {...props} />;
}
