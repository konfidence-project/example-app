import type { NextConfig } from "next";

type ConfigFunction = (
  phase: string,
  ctx: { defaultConfig: NextConfig },
) => NextConfig | Promise<NextConfig>;

/** Registers the Konfidence deployment adapter on a Next.js config. */
export function withKonfidence(nextConfig?: NextConfig): NextConfig;
export function withKonfidence(nextConfig: ConfigFunction): ConfigFunction;
