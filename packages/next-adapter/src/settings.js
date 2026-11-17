// Settings shared by the build adapter and the publish command.
//
// An app opts in with a "konfidence" key in its package.json:
//
//   "konfidence": { "component": "github.com/acme/shop/web" }
//
// Everything else has a default derived from the component name.
import fs from "node:fs";
import path from "node:path";

export const BUILD_SCHEMA = "cloud.konfidence.nextjs.build/v1";
export const HELM_ARTIFACT_TYPE = "helm.konfidence.cloud";
export const S3_ARTIFACT_TYPE = "s3.konfidence.cloud";
export const S3_RESOURCE_TYPE = "s3.konfidence.cloud/v1alpha1";

/**
 * @typedef {object} Settings
 * @property {string} component         OCM component of the Node server artifact.
 * @property {string} staticComponent   OCM component of the static bundle artifact.
 * @property {string} name              Short name: image, chart and Kubernetes object prefix.
 * @property {string} deploymentResult  Stable name other services resolve this server by.
 * @property {string} provider          OCM provider name.
 * @property {number} port              Port the Next.js server listens on in the container.
 */

/**
 * @param {string} projectDir
 * @returns {Settings}
 */
export function loadSettings(projectDir) {
  const pkgPath = path.join(projectDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const raw = pkg.konfidence ?? {};
  const component = process.env.KONFIDENCE_COMPONENT ?? raw.component;
  if (!component) {
    throw new Error(
      `@konfidence/next-adapter: no component name. Add "konfidence": { "component": "<host>/<org>/<app>/<name>" } to ${pkgPath}`,
    );
  }
  const name = raw.name ?? component.slice(component.lastIndexOf("/") + 1);
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name)) {
    throw new Error(
      `@konfidence/next-adapter: "${name}" is not a valid DNS label, set "konfidence.name" in ${pkgPath}`,
    );
  }
  return {
    component,
    staticComponent: raw.staticComponent ?? `${component}-static`,
    name,
    deploymentResult: raw.deploymentResult ?? name,
    provider: raw.provider ?? "konfidence-project",
    port: Number(raw.port ?? 3000),
  };
}

/** The artifact version of this build, if the caller set one. */
export function buildVersion() {
  return process.env.KONFIDENCE_VERSION || process.env.VERSION || "";
}

/** Next.js only allows [a-zA-Z0-9_-] in a deployment id. */
export function toDeploymentId(version) {
  return version.replace(/[^a-zA-Z0-9_-]/g, "-");
}
