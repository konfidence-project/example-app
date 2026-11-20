import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

import type { NextAdapter } from "next";

import nextAdapter from "./adapter.js";
import { DEFAULT_NODE_IMAGE, packageArtifacts, publish } from "./publish.js";

type BuildContext = Parameters<NonNullable<NextAdapter["onBuildComplete"]>>[0];
type Config = Parameters<NonNullable<NextAdapter["modifyConfig"]>>[0];
type Phase = Parameters<NonNullable<NextAdapter["modifyConfig"]>>[1]["phase"];

// The adapter's hooks with the loose fakes below, which carry only the
// fields the adapter reads.
const adapter = {
  modifyConfig: (config: object, { phase }: { phase: string }) =>
    nextAdapter.modifyConfig!(config as Config, {
      phase: phase as Phase,
      nextVersion: "16.4.6",
      projectDir: "",
    }) as Config,
  onBuildComplete: (ctx: object) =>
    nextAdapter.onBuildComplete!(ctx as unknown as BuildContext) as Promise<void>,
};

// A minimal stand-in for what Next.js hands to an adapter after a build.
function fakeBuild({ assetPrefix = "", basePath = "" } = {}) {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "kfd-next-"));
  const distDir = path.join(projectDir, ".next");
  const write = (file: string, text = "x") => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    return file;
  };
  write(
    path.join(projectDir, "package.json"),
    JSON.stringify({ konfidence: { component: "example.com/acme/shop/web" } }),
  );
  write(path.join(projectDir, "public", "logo.svg"));
  write(path.join(distDir, "standalone", "server.js"));
  const chunk = write(path.join(distDir, "static", "chunks", "abc.js"), "chunk");
  const notFound = write(path.join(distDir, "server", "pages", "404.html"));
  const route = (pathname: string, runtime = "nodejs") => ({ pathname, runtime });
  return {
    projectDir,
    repoRoot: projectDir,
    distDir,
    buildId: "build-1",
    nextVersion: "16.4.6",
    config: { assetPrefix, basePath, deploymentId: "1-2-3" },
    outputs: {
      pages: [],
      pagesApi: [],
      appPages: [route("/"), route("/index.rsc"), route("/about")],
      appRoutes: [route("/api/geo", "edge")],
      prerenders: [route("/about"), route("/about.segments/_tree.segment.rsc")],
      staticFiles: [
        { pathname: "/_next/static/chunks/abc.js", filePath: chunk },
        { pathname: "/404", filePath: notFound },
      ],
      middleware: {
        runtime: "nodejs",
        config: { matchers: [{ source: "/admin/:path*", sourceRegex: "secret" }] },
      },
    },
  };
}

const readBuild = (ctx: { distDir: string }) =>
  JSON.parse(fs.readFileSync(path.join(ctx.distDir, "konfidence", "build.json"), "utf8"));

test("modifyConfig forces a standalone server and derives the deployment id from the version", () => {
  process.env.VERSION = "1.2.3-rc.1";
  const out = adapter.modifyConfig({ output: undefined }, { phase: "phase-production-build" });
  assert.equal(out.output, "standalone");
  assert.equal(out.deploymentId, "1-2-3-rc-1");
  const dev = adapter.modifyConfig({ output: undefined }, { phase: "phase-development-server" });
  assert.equal(dev.output, undefined);
});

test("onBuildComplete stages only /_next/static and classifies routes by runtime", async () => {
  process.env.VERSION = "1.2.3";
  const ctx = fakeBuild();
  await adapter.onBuildComplete(ctx);
  const build = readBuild(ctx);
  const staticDir = path.join(ctx.distDir, "konfidence", "static");

  assert.equal(fs.readFileSync(path.join(staticDir, "chunks", "abc.js"), "utf8"), "chunk");
  assert.deepEqual(fs.readdirSync(staticDir), ["chunks"]);
  assert.equal(build.static.route, "/_next/static");
  assert.equal(build.static.files, 1);
  assert.deepEqual(build.routes.compute, ["/", "/about"]);
  assert.deepEqual(build.routes.edge, ["/api/geo"]);
  assert.deepEqual(build.routes.prerendered, ["/about"]);
  assert.deepEqual(build.routes.middleware, { runtime: "nodejs", matchers: ["/admin/:path*"] });
  assert.equal(build.settings.staticComponent, "example.com/acme/shop/web-static");
});

test("the static route follows basePath, and a host in assetPrefix is rejected", async () => {
  const withBase = fakeBuild({ basePath: "/shop" });
  await adapter.onBuildComplete(withBase);
  assert.equal(readBuild(withBase).static.route, "/shop/_next/static");

  await assert.rejects(
    adapter.onBuildComplete(fakeBuild({ assetPrefix: "https://cdn.example.com" })),
    /names a host/,
  );
});

test("packageArtifacts writes image context, chart and both constructors", async () => {
  process.env.VERSION = "1.2.3";
  const ctx = fakeBuild();
  await adapter.onBuildComplete(ctx);
  packageArtifacts({ projectDir: ctx.projectDir, registry: "registry.example.com/shop" });
  const out = path.join(ctx.distDir, "konfidence");
  const read = (file: string) => fs.readFileSync(path.join(out, file), "utf8");

  assert.match(read("image/Dockerfile"), /CMD \["node", "server.js"\]/);
  assert.ok(fs.existsSync(path.join(out, "image/app/.next/static/chunks/abc.js")));
  assert.ok(fs.existsSync(path.join(out, "image/app/public/logo.svg")));
  assert.match(read("chart/values.yaml"), /repository: registry\.example\.com\/shop\/web/);
  assert.match(read("chart/templates/service.yaml"), /deployment-result: web/);
  assert.match(read("server.component-constructor.yaml"), /type: helm\.konfidence\.cloud/);
  assert.match(
    read("server.component-constructor.yaml"),
    /imageReference: "registry\.example\.com\/shop\/web-chart:1\.2\.3"/,
  );
  assert.match(read("static.component-constructor.yaml"), /route: "\/_next\/static"/);
  assert.match(read("static.component-constructor.yaml"), /type: s3\.konfidence\.cloud\n/);
});

test("a plain-HTTP registry is marked as such in the OCI references", async () => {
  process.env.VERSION = "1.2.3";
  process.env.KONFIDENCE_REGISTRY_URL = "http://registry.localhost:5001/shop";
  try {
    const ctx = fakeBuild();
    await adapter.onBuildComplete(ctx);
    packageArtifacts({ projectDir: ctx.projectDir, registry: "registry.localhost:5001/shop" });
    const out = path.join(ctx.distDir, "konfidence");
    const constructor = fs.readFileSync(
      path.join(out, "server.component-constructor.yaml"),
      "utf8",
    );
    assert.match(
      constructor,
      /imageReference: "http:\/\/registry\.localhost:5001\/shop\/web-chart:1\.2\.3"/,
    );
    assert.match(
      constructor,
      /imageReference: "http:\/\/registry\.localhost:5001\/shop\/web:1\.2\.3"/,
    );
    // The chart pulls the image through the container runtime, which takes no scheme.
    assert.match(
      fs.readFileSync(path.join(out, "chart/values.yaml"), "utf8"),
      /repository: registry\.localhost:5001\/shop\/web\n/,
    );
  } finally {
    delete process.env.KONFIDENCE_REGISTRY_URL;
  }
});

test("publishing under another version than the build is refused", async () => {
  process.env.VERSION = "1.2.3";
  const ctx = fakeBuild();
  await adapter.onBuildComplete(ctx);
  assert.throws(
    () =>
      packageArtifacts({
        projectDir: ctx.projectDir,
        registry: "r.example.com/x",
        version: "9.9.9",
      }),
    /made for version 1\.2\.3, not 9\.9\.9/,
  );
});

test("the production config keeps revalidated pages off the read-only disk", () => {
  const out = adapter.modifyConfig({}, { phase: "phase-production-build" });
  assert.equal(out.experimental.isrFlushToDisk, false);
  const own = adapter.modifyConfig(
    { experimental: { isrFlushToDisk: true } },
    { phase: "phase-production-build" },
  );
  assert.equal(own.experimental.isrFlushToDisk, true);
});

test("the chart mounts the Next.js cache and probes the health path", async () => {
  process.env.VERSION = "1.2.3";
  const ctx = fakeBuild();
  const pkg = path.join(ctx.projectDir, "package.json");
  fs.writeFileSync(
    pkg,
    JSON.stringify({
      konfidence: { component: "example.com/acme/shop/web", healthPath: "/api/healthz" },
    }),
  );
  await adapter.onBuildComplete(ctx);
  packageArtifacts({ projectDir: ctx.projectDir, registry: "registry.example.com/shop" });
  const chart = path.join(ctx.distDir, "konfidence", "chart");
  const deployment = fs.readFileSync(path.join(chart, "templates/deployment.yaml"), "utf8");
  assert.match(deployment, /mountPath: \/app\/\.next\/cache\n/);
  assert.doesNotMatch(deployment, /\$\{[A-Z_]+\}/);
  assert.match(
    fs.readFileSync(path.join(chart, "values.yaml"), "utf8"),
    /healthPath: "\/api\/healthz"/,
  );
});

test("the image runs on a pinned Node.js", async () => {
  process.env.VERSION = "1.2.3";
  const ctx = fakeBuild();
  await adapter.onBuildComplete(ctx);
  packageArtifacts({ projectDir: ctx.projectDir, registry: "registry.example.com/shop" });
  const dockerfile = fs.readFileSync(
    path.join(ctx.distDir, "konfidence", "image", "Dockerfile"),
    "utf8",
  );
  assert.match(dockerfile, new RegExp(`^FROM ${DEFAULT_NODE_IMAGE.replace(".", "\\.")}$`, "m"));
});

test("publish pushes both components before it moves any alias", async () => {
  process.env.VERSION = "1.2.3";
  const ctx = fakeBuild();
  await adapter.onBuildComplete(ctx);
  const calls = path.join(ctx.projectDir, "calls.log");
  const tool = path.join(ctx.projectDir, "tool.sh");
  fs.writeFileSync(tool, `#!/bin/sh\necho "$(basename "$0") $*" >> "${calls}"\n`, { mode: 0o755 });
  for (const name of ["docker", "helm", "kden"])
    fs.symlinkSync(tool, path.join(ctx.projectDir, name));
  const env = { DOCKER: "docker", HELM: "helm", KDEN: "kden" };
  for (const [key, name] of Object.entries(env)) process.env[key] = path.join(ctx.projectDir, name);
  try {
    publish({ projectDir: ctx.projectDir, registry: "registry.example.com/shop" });
  } finally {
    for (const key of Object.keys(env)) delete process.env[key];
  }
  const kden = fs
    .readFileSync(calls, "utf8")
    .trim()
    .split("\n")
    .filter((line) => line.startsWith("kden "))
    .map(
      (line) =>
        line.split(" ").slice(1, 3).join(" ") +
        (line.includes("web-static:") ? " static" : line.includes("alias") ? " server" : ""),
    );
  assert.deepEqual(kden, [
    "artifact push",
    "artifact push",
    "artifact alias static",
    "artifact alias server",
  ]);
});
