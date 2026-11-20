import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    sveltekit({
      adapter: adapter(),
      // TLS ends at the edge and proxies in front of web rewrite X-Forwarded-Proto, so SvelteKit's origin check
      // (which compares scheme too) rejects legitimate form posts. hooks.server.ts enforces a host-only check instead.
      csrf: { trustedOrigins: ["*"] },
      compilerOptions: {
        // Runes everywhere in app code; leave third-party components to their own mode.
        runes: ({ filename }) => (filename.split(/[/\\]/).includes("node_modules") ? undefined : true),
      },
    }),
  ],
});
