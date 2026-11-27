import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next build` writes a self-contained server to .next/standalone. The
  // Dockerfile copies it into the image.
  output: "standalone",
  // pnpm keeps node_modules at the workspace root, so tracing starts there.
  // The server is then .next/standalone/services/web/server.js.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  // Next.js traces sharp into every standalone build. The app optimizes no
  // images, and the binaries are built for the host's OS, not for the image.
  outputFileTracingExcludes: { "*": ["../../node_modules/.pnpm/{@img+sharp,sharp@}*/**"] },
  // One id for the server and the static files of a build. Next.js puts it
  // on the page and on every static file URL, so a browser tab notices when
  // it talks to a server of another build and reloads.
  deploymentId: process.env.VERSION?.replace(/[^a-zA-Z0-9_-]/g, "-"),
};

export default nextConfig;
