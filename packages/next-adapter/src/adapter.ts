// Next.js deployment adapter for Konfidence.
//
// It observes one `next build` and writes what the publish command needs into
// <distDir>/konfidence/:
//
//   static/      the files a static content deployer uploads, rooted at the
//                public route /_next/static
//   build.json   what was built: version, routes per target, where the server
//                entry point lives
//
// The app stays unaware of the vector it ends up in. Asset URLs are relative
// to the origin, and Konfidence decides at request time which vector serves
// them. The only build input is an optional artifact version.
import fs from "node:fs/promises";
import path from "node:path";

import type { AdapterOutput, NextAdapter } from "next";

import { BUILD_SCHEMA, buildVersion, loadSettings, toDeploymentId } from "./settings.js";
import type { BuildManifest, RouteClassification } from "./types.js";

type BuildContext = Parameters<NonNullable<NextAdapter["onBuildComplete"]>>[0];
type Config = BuildContext["config"];
type Outputs = BuildContext["outputs"];

const PHASE_PRODUCTION_BUILD = "phase-production-build";
const STATIC_PREFIX = "/_next/static/";
const ADAPTER_NAME = "@konfidence/next-adapter";

const adapter: NextAdapter = {
  name: ADAPTER_NAME,

  modifyConfig(config, { phase }) {
    if (phase !== PHASE_PRODUCTION_BUILD) return config;
    const next: typeof config = {
      ...config,
      output: "standalone",
      // The generated chart runs the server on a read-only root filesystem.
      // Revalidated pages then stay in memory instead of being written back
      // into .next/server. An app that sets the option keeps its own value.
      experimental: { isrFlushToDisk: false, ...config.experimental },
      // No image optimization, so the server never loads sharp. The packaging
      // step drops it from the image.
      images: { ...config.images, unoptimized: true },
    };
    // A deployment id lets a browser tab notice that the server it talks to
    // comes from another build and reload, instead of mixing two builds.
    const version = buildVersion();
    if (version && !config.deploymentId) next.deploymentId = toDeploymentId(version);
    return next;
  },

  async onBuildComplete(ctx) {
    const settings = loadSettings(ctx.projectDir);
    const outDir = path.join(ctx.distDir, "konfidence");
    await fs.rm(outDir, { recursive: true, force: true });
    await fs.mkdir(outDir, { recursive: true });

    const staticRoute = publicStaticRoute(ctx.config);
    const staged = await stageStaticFiles(
      ctx.outputs.staticFiles ?? [],
      path.join(outDir, "static"),
    );
    const routes = classify(ctx.outputs);

    const build: BuildManifest = {
      schema: BUILD_SCHEMA,
      adapter: ADAPTER_NAME,
      version: buildVersion() || null,
      settings,
      next: {
        version: ctx.nextVersion,
        buildId: ctx.buildId,
        deploymentId: ctx.config.deploymentId || null,
        basePath: ctx.config.basePath || "",
      },
      server: {
        // Next.js mirrors the project's path below the tracing root inside
        // .next/standalone, so the entry point is not always at the top.
        entry: path.posix.join(
          toPosix(path.relative(ctx.repoRoot ?? ctx.projectDir, ctx.projectDir)),
          "server.js",
        ),
        port: settings.port,
      },
      static: { dir: "static", route: staticRoute, files: staged.files, bytes: staged.bytes },
      // Which runtime answers which path. A deployer or an edge configuration
      // can translate this without knowing Next.js.
      targets: [
        {
          target: "static",
          match: { pathPrefix: `${staticRoute}/` },
          headers: { "cache-control": "public, max-age=31536000, immutable" },
        },
        { target: "compute", match: { pathPrefix: `${ctx.config.basePath || ""}/` } },
      ],
      routes,
    };
    await fs.writeFile(path.join(outDir, "build.json"), JSON.stringify(build, null, 2) + "\n");

    const edge = routes.edge.length;
    console.log(
      `   ${ADAPTER_NAME}: ${staged.files} static files (${formatBytes(staged.bytes)}) for ${staticRoute}, ` +
        `${routes.compute.length} server routes` +
        (edge ? `, ${edge} edge-runtime routes (served by the Node server for now)` : ""),
    );
  },
};

export default adapter;

/** The public path prefix the static bundle is served under. */
function publicStaticRoute(config: Pick<Config, "assetPrefix" | "basePath">): string {
  const assetPrefix = config.assetPrefix || "";
  if (/^(https?:)?\/\//.test(assetPrefix)) {
    throw new Error(
      `${ADAPTER_NAME}: assetPrefix "${assetPrefix}" names a host. A Konfidence vector is promoted unchanged ` +
        `across stages, so the build must not contain a stage-specific host. Remove assetPrefix or use a path.`,
    );
  }
  let prefix = assetPrefix || config.basePath || "";
  while (prefix.endsWith("/")) prefix = prefix.slice(0, -1);
  return `${prefix}/_next/static`;
}

/**
 * Copies every /_next/static file into dir, with the static route as root.
 */
async function stageStaticFiles(
  staticFiles: AdapterOutput["STATIC_FILE"][],
  dir: string,
): Promise<{ files: number; bytes: number }> {
  await fs.mkdir(dir, { recursive: true });
  let files = 0;
  let bytes = 0;
  for (const file of staticFiles) {
    const at = file.pathname.indexOf(STATIC_PREFIX);
    if (at === -1) continue; // 404.html and friends stay with the server
    const target = path.join(dir, file.pathname.slice(at + STATIC_PREFIX.length));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(file.filePath, target);
    bytes += (await fs.stat(target)).size;
    files += 1;
  }
  if (files === 0)
    throw new Error(`${ADAPTER_NAME}: the build produced no files under ${STATIC_PREFIX}`);
  return { files, bytes };
}

/** Sorts the build outputs by the runtime that has to answer them. */
function classify(outputs: Outputs): RouteClassification {
  const functions = [
    ...(outputs.pages ?? []),
    ...(outputs.pagesApi ?? []),
    ...(outputs.appPages ?? []),
    ...(outputs.appRoutes ?? []),
  ];
  // Every page also exists as an RSC payload and as prefetch segments. Those
  // follow their page, so the page path alone describes the route.
  const isVariant = (pathname: string) =>
    pathname.endsWith(".rsc") || pathname.includes(".segments/");
  const pathnames = (list: { pathname: string }[]) =>
    [...new Set(list.map((o) => o.pathname).filter((p) => !isVariant(p)))].sort();
  const middleware = outputs.middleware
    ? {
        runtime: outputs.middleware.runtime,
        // Only the source patterns. The compiled matchers carry build secrets.
        matchers: (outputs.middleware.config?.matchers ?? []).map((m) => m.source).filter(Boolean),
      }
    : null;
  return {
    compute: pathnames(functions.filter((o) => o.runtime !== "edge")),
    edge: pathnames(functions.filter((o) => o.runtime === "edge")),
    prerendered: pathnames(outputs.prerenders ?? []),
    middleware,
  };
}

const toPosix = (p: string) => p.split(path.sep).join("/");

function formatBytes(n: number): string {
  return n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} kB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}
