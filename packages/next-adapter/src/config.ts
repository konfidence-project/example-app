// next.config helper: `export default withKonfidence({ ...your config })`.
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const adapterPath = fileURLToPath(new URL("./adapter.js", import.meta.url));

export type ConfigFunction = (
  phase: string,
  ctx: { defaultConfig: NextConfig },
) => NextConfig | Promise<NextConfig>;

/** Registers the Konfidence deployment adapter on a Next.js config. */
export function withKonfidence(nextConfig?: NextConfig): NextConfig;
export function withKonfidence(nextConfig: ConfigFunction): ConfigFunction;
export function withKonfidence(
  nextConfig: NextConfig | ConfigFunction = {},
): NextConfig | ConfigFunction {
  if (typeof nextConfig === "function") {
    return async (phase, ctx) => ({ ...(await nextConfig(phase, ctx)), adapterPath });
  }
  return { ...nextConfig, adapterPath };
}
