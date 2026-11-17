import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import adapter from "../src/adapter.js";
import { packageArtifacts } from "../src/publish.js";

// A minimal stand-in for what Next.js hands to an adapter after a build.
function fakeBuild({ assetPrefix = "", basePath = "" } = {}) {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "kfd-next-"));
  const distDir = path.join(projectDir, ".next");
  const write = (file, text = "x") => {
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
  const route = (pathname, runtime = "nodejs") => ({ pathname, runtime });
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

const readBuild = (ctx) =>
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
  const read = (file) => fs.readFileSync(path.join(out, file), "utf8");

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
