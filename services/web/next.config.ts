import type { NextConfig } from "next";
import { withKonfidence } from "@konfidence/next-adapter/config";

// In production the browser calls /candidates and /interviews on its own
// origin, and the routing in front of Konfidence sends those paths to the
// right service of the active vector. `next dev` has no such routing, so it
// proxies the two paths to locally running services instead.
const devBackends = {
  candidates: process.env.KONFIDENCE_SERVICE_CANDIDATES_URL,
  interviews: process.env.KONFIDENCE_SERVICE_INTERVIEWS_URL,
};

const nextConfig: NextConfig = {
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return Object.entries(devBackends)
      .filter(([, url]) => url)
      .map(([name, url]) => ({ source: `/${name}/:path*`, destination: `${url}/${name}/:path*` }));
  },
};

// The only Konfidence-specific line. The adapter turns the build into
// deployable artifacts, see packages/next-adapter.
export default withKonfidence(nextConfig);
