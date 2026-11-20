import type { InterviewType } from "@/types/api";

import { Badge } from "./ui/badge";

export function InterviewTypeBadge({ type }: { type: InterviewType }) {
  return <Badge tone={type === "video" ? "info" : "neutral"}>{type}</Badge>;
}
