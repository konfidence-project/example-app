// Turns the output of `next build` (with the Konfidence adapter) into two
// Konfidence artifacts and publishes them:
//
//   <component>          helm.konfidence.cloud   the Node server: image + chart
//   <component>-static   s3.konfidence.cloud     the /_next/static bundle
//
// The app author writes no Dockerfile, chart or OCM constructor. Everything is
// generated into <distDir>/konfidence/ and can be inspected there.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BUILD_SCHEMA,
  HELM_ARTIFACT_TYPE,
  S3_ARTIFACT_TYPE,
  S3_RESOURCE_TYPE,
  buildVersion,
} from "./settings.js";

const CHART_TEMPLATE = fileURLToPath(new URL("../charts/server", import.meta.url));

/**
 * @typedef {object} Options
 * @property {string} projectDir
 * @property {string} [distDir]      Next.js distDir, default <projectDir>/.next
 * @property {string} [registry]     Repository prefix without scheme, e.g. ghcr.io/acme/shop
 * @property {string} [version]      Artifact version, must match the version of the build
 * @property {string} [platforms]    Image platforms, default linux/amd64,linux/arm64
 * @property {boolean} [staticInImage] Also copy /_next/static into the image (default true)
 * @property {boolean} [alias]       Move the floating `edge` alias to this version (default true)
 */

/** Generates image context, chart and OCM constructors. Touches no registry. */
export function packageArtifacts(options) {
  const ctx = resolveContext(options);
  const { outDir, build, settings, registry, version } = ctx;

  stageImage(ctx, options.staticInImage !== false);
  renderChart(ctx);

  const image = `${registry}/${settings.name}:${version}`;
  const chart = `${registry}/${settings.name}-chart:${version}`;
  // OCM and the Flux deployer assume HTTPS unless a reference says otherwise.
  const scheme = registryUrl(registry).startsWith("http://") ? "http://" : "";
  fs.writeFileSync(
    path.join(outDir, "server.component-constructor.yaml"),
    serverConstructor(ctx, `${scheme}${image}`, `${scheme}${chart}`),
  );
  fs.writeFileSync(path.join(outDir, "static.component-constructor.yaml"), staticConstructor(ctx));

  log(
    `packaged ${settings.component} and ${settings.staticComponent} at ${version} in ${rel(outDir)}`,
  );
  return { ...ctx, image, chart, build };
}

/** Packages, then pushes image, chart and both OCM components. */
export function publish(options) {
  const ctx = packageArtifacts(options);
  const { outDir, settings, registry, version, image } = ctx;
  const docker = process.env.DOCKER ?? "docker";
  const helm = process.env.HELM ?? "helm";
  const kden = process.env.KDEN ?? "kden";
  const ocmRepository = registryUrl(registry);
  const platforms = options.platforms ?? process.env.PLATFORMS ?? "linux/amd64,linux/arm64";

  log(`building and pushing ${image} for ${platforms}`);
  run(docker, [
    "buildx",
    "build",
    "--platform",
    platforms,
    "--push",
    "-t",
    image,
    ...extraArgs("DOCKER_BUILD_ARGS"),
    path.join(outDir, "image"),
  ]);

  log("publishing Helm chart");
  run(helm, [
    "package",
    path.join(outDir, "chart"),
    "--version",
    version,
    "--app-version",
    version,
    "--destination",
    outDir,
  ]);
  run(helm, [
    "push",
    path.join(outDir, `${settings.name}-chart-${version}.tgz`),
    `oci://${registry}`,
    ...extraArgs("HELM_PUSH_ARGS"),
  ]);

  for (const [file, component] of [
    ["server.component-constructor.yaml", settings.component],
    ["static.component-constructor.yaml", settings.staticComponent],
  ]) {
    log(`pushing OCM component ${component}:${version}`);
    // kden resolves input paths relative to the working directory.
    run(kden, ["artifact", "push", "--registry", ocmRepository, "--file", file], { cwd: outDir });
    if (options.alias !== false) {
      run(kden, ["artifact", "alias", `${ocmRepository}//${component}:${version}`, "edge"]);
    }
  }
  log(`done. ${settings.component} and ${settings.staticComponent} are published at ${version}`);
  return ctx;
}

/** The OCM repository URL. Only a local registry needs anything but https. */
const registryUrl = (registry) => process.env.KONFIDENCE_REGISTRY_URL ?? `https://${registry}`;

function resolveContext(options) {
  const projectDir = path.resolve(options.projectDir);
  const distDir = path.resolve(projectDir, options.distDir ?? ".next");
  const outDir = path.join(distDir, "konfidence");
  const buildFile = path.join(outDir, "build.json");
  if (!fs.existsSync(buildFile)) {
    throw new Error(
      `${rel(buildFile)} not found. Run \`next build\` with the Konfidence adapter first.`,
    );
  }
  const build = JSON.parse(fs.readFileSync(buildFile, "utf8"));
  if (build.schema !== BUILD_SCHEMA)
    throw new Error(`${rel(buildFile)} has schema ${build.schema}, expected ${BUILD_SCHEMA}`);

  const registry = options.registry ?? process.env.REGISTRY;
  if (!registry)
    throw new Error("no registry. Set REGISTRY or pass --registry (repository prefix, no scheme)");
  const version = options.version ?? (buildVersion() || build.version);
  if (!version)
    throw new Error(
      "no version. Set VERSION for `next build` and for this command, or pass --version",
    );
  if (build.version && build.version !== version) {
    throw new Error(
      `the build was made for version ${build.version}, not ${version}. Rebuild with VERSION=${version}`,
    );
  }
  if (!build.version) {
    log(`warning: the build has no VERSION, so browsers cannot detect a switch to another build`);
  }
  return { projectDir, distDir, outDir, build, settings: build.settings, registry, version };
}

/** Builds the Docker context: the standalone server, plus public/ and optionally the static files. */
function stageImage({ projectDir, distDir, outDir, build, settings }, staticInImage) {
  const standalone = path.join(distDir, "standalone");
  if (!fs.existsSync(path.join(standalone, build.server.entry))) {
    throw new Error(
      `${rel(path.join(standalone, build.server.entry))} not found. The build must use output: 'standalone'`,
    );
  }
  const context = path.join(outDir, "image");
  const app = path.join(context, "app");
  fs.rmSync(context, { recursive: true, force: true });
  fs.cpSync(standalone, app, { recursive: true, verbatimSymlinks: true });

  const appRoot = path.join(app, path.dirname(build.server.entry));
  if (staticInImage) {
    // The server can then answer /_next/static itself. Whether a request ever
    // reaches it is decided by the routing in front, not by the image.
    fs.cpSync(path.join(distDir, "static"), path.join(appRoot, path.basename(distDir), "static"), {
      recursive: true,
    });
  }
  const publicDir = path.join(projectDir, "public");
  if (fs.existsSync(publicDir))
    fs.cpSync(publicDir, path.join(appRoot, "public"), { recursive: true });

  const sharp = prepareSharp(app);
  const native = findNativeModules(app);
  if (native.length) {
    log(
      `warning: the server contains native modules built on ${process.platform}/${process.arch}: ${native.slice(0, 3).join(", ")}`,
    );
    log(
      "         they only work in the image if the build ran on the same OS and CPU as the image platform",
    );
  }

  const nodeImage =
    process.env.KONFIDENCE_NODE_IMAGE ?? `node:${process.versions.node.split(".")[0]}-alpine`;
  fs.writeFileSync(
    path.join(context, "Dockerfile"),
    [
      `# Generated by @konfidence/next-adapter. The server is built already, the image only runs it.`,
      ...(sharp
        ? [
            `# Next.js optimizes images with sharp, which ships one native binary per`,
            `# platform. The build machine's binary was removed from app/, this stage`,
            `# fetches the one for each image platform.`,
            `FROM ${nodeImage} AS sharp`,
            `WORKDIR /sharp`,
            `RUN npm install --no-audit --no-fund --no-package-lock sharp@${sharp.version}`,
            ``,
          ]
        : []),
      `FROM ${nodeImage}`,
      `ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=${settings.port}`,
      `WORKDIR /app`,
      `COPY --chown=node:node app/ ./`,
      ...(sharp
        ? [`COPY --from=sharp --chown=node:node /sharp/node_modules/@img ./${sharp.imgDir}`]
        : []),
      `USER node`,
      `EXPOSE ${settings.port}`,
      `CMD ["node", ${JSON.stringify(build.server.entry)}]`,
      ``,
    ].join("\n"),
  );
}

/**
 * Removes the build machine's sharp binaries from the staged app and reports
 * where the image build has to put the right ones.
 * @returns {{version: string, imgDir: string} | null}
 */
function prepareSharp(app) {
  const sharpPkg = path.join(app, "node_modules", "sharp", "package.json");
  if (!fs.existsSync(sharpPkg)) return null;
  const imgDir = path.join(app, "node_modules", "@img");
  fs.rmSync(imgDir, { recursive: true, force: true });
  return {
    version: JSON.parse(fs.readFileSync(sharpPkg, "utf8")).version,
    imgDir: "node_modules/@img",
  };
}

function renderChart({ outDir, settings, registry }) {
  const chartDir = path.join(outDir, "chart");
  fs.rmSync(chartDir, { recursive: true, force: true });
  fs.cpSync(CHART_TEMPLATE, chartDir, { recursive: true });
  const values = {
    NAME: settings.name,
    REGISTRY: registry,
    PORT: String(settings.port),
    DEPLOYMENT_RESULT: settings.deploymentResult,
  };
  for (const file of walk(chartDir)) {
    const text = fs.readFileSync(file, "utf8");
    fs.writeFileSync(
      file,
      text.replace(/\$\{(\w+)\}/g, (all, key) => values[key] ?? all),
    );
  }
}

function serverConstructor({ settings, version }, image, chart) {
  const q = JSON.stringify;
  return `# Generated by @konfidence/next-adapter.
components:
  - name: ${q(settings.component)}
    version: ${q(version)}
    provider:
      name: ${q(settings.provider)}
    sources: []
    resources:
      - name: ${q(`${settings.name}-chart`)}
        version: ${q(version)}
        relation: external
        type: helmChart
        access:
          type: ociArtifact
          imageReference: ${q(chart)}

      - name: ${q(`${settings.name}-image`)}
        version: ${q(version)}
        relation: external
        type: ociImage
        access:
          type: ociArtifact
          imageReference: ${q(image)}

      - name: konfidence-manifest
        relation: local
        type: cloud.konfidence.artifact.manifest
        input:
          type: UTF8/v1
          yaml:
            type: ${HELM_ARTIFACT_TYPE}
            allowReuse: true
`;
}

function staticConstructor({ settings, version, build }) {
  const q = JSON.stringify;
  return `# Generated by @konfidence/next-adapter.
components:
  - name: ${q(settings.staticComponent)}
    version: ${q(version)}
    provider:
      name: ${q(settings.provider)}
    sources: []
    resources:
      # The archive root maps to the public route below. The static content
      # deployer uploads it, and serving resolves the route per vector.
      - name: next-static
        version: ${q(version)}
        relation: local
        type: ${S3_RESOURCE_TYPE}
        labels:
          - name: ${S3_RESOURCE_TYPE}
            value:
              route: ${q(build.static.route)}
        input:
          type: Dir/v1
          path: ./${build.static.dir}
          compress: true
          reproducible: true
          preserveDir: false

      - name: konfidence-manifest
        relation: local
        type: cloud.konfidence.artifact.manifest
        input:
          type: UTF8/v1
          yaml:
            type: ${S3_ARTIFACT_TYPE}
            allowReuse: true
`;
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

function findNativeModules(dir) {
  const found = [];
  for (const file of walk(dir)) if (file.endsWith(".node")) found.push(path.relative(dir, file));
  return found;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error?.code === "ENOENT")
    throw new Error(`"${command}" is not installed or not on PATH`);
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `${command} ${args.slice(0, 2).join(" ")} failed with exit code ${result.status}`,
    );
}

/** Extra CLI arguments from an environment variable, e.g. HELM_PUSH_ARGS="--plain-http". */
const extraArgs = (name) => (process.env[name] ?? "").split(/\s+/).filter(Boolean);

const rel = (p) => path.relative(process.cwd(), p) || ".";
const log = (message) => console.log(`==> [konfidence-next] ${message}`);
