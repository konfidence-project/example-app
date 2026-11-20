import "server-only";
import { features } from "@konfidence/next-adapter/server";
import { unstable_rethrow } from "next/navigation";

import type { FeatureFlags } from "@/types/api";

// The vector's feature flags, mapped to what they mean for the UI. The
// flag names stay in this file and never reach the page.
//
// When the flags cannot be read, every feature stays off: the pages still
// work, just without the optional parts.
export async function getFeatureFlags(): Promise<FeatureFlags> {
  let flags: Record<string, unknown> = {};
  try {
    flags = await features();
  } catch (err) {
    // Next.js signals dynamic rendering and redirects with errors. Those
    // must reach Next.js, they are not failures.
    unstable_rethrow(err);
    console.error("feature flags unavailable, every feature is off:", err);
  }
  return {
    videoSlots: flags["allow-video-slots"] === true,
    candidateNotes: flags["enable-candidate-notes"] === true,
  };
}
