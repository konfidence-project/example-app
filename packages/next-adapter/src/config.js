// next.config helper: `export default withKonfidence({ ...your config })`.
import { fileURLToPath } from "node:url";

const adapterPath = fileURLToPath(new URL("./adapter.js", import.meta.url));

export function withKonfidence(nextConfig = {}) {
  if (typeof nextConfig === "function") {
    return async (phase, ctx) => ({ ...(await nextConfig(phase, ctx)), adapterPath });
  }
  return { ...nextConfig, adapterPath };
}
