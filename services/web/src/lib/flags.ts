import "server-only";
import { features } from "@konfidence/next-adapter/server";

import type { FeatureFlags } from "@/types/api";

// The vector's feature flags, mapped to what they mean for the UI. The
// flag names stay in this file and never reach the page.
export async function getFeatureFlags(): Promise<FeatureFlags> {
  const flags = await features().catch(() => ({}) as Record<string, unknown>);
  return {
    videoSlots: flags["allow-video-slots"] === true,
    candidateNotes: flags["enable-candidate-notes"] === true,
  };
}
