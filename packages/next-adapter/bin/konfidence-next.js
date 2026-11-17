#!/usr/bin/env node
import { packageArtifacts, publish } from "../src/publish.js";

const USAGE = `Usage: konfidence-next <command> [options]

Run after \`next build\`. Reads <dir>/.next/konfidence/build.json, which the
Konfidence adapter writes during the build.

Commands:
  package   Generate the image context, Helm chart and OCM constructors. No registry access.
  publish   Package, then push the image, the chart and both OCM components.

Options:
  --dir <path>          Next.js project directory (default: current directory)
  --registry <prefix>   Repository prefix without scheme (default: $REGISTRY)
  --version <version>   Artifact version (default: $VERSION, must match the build)
  --platforms <list>    Image platforms (default: $PLATFORMS or linux/amd64,linux/arm64)
  --no-static-in-image  Leave /_next/static out of the server image
  --no-alias            Do not move the floating "edge" alias to this version

Environment:
  KONFIDENCE_REGISTRY_URL  OCM repository URL (default: https://$REGISTRY)
  DOCKER_BUILD_ARGS, HELM_PUSH_ARGS  Extra arguments, e.g. HELM_PUSH_ARGS=--plain-http
  DOCKER, HELM, KDEN       Paths of the tools to call
`;

function parse(argv) {
  const [command, ...rest] = argv;
  const options = { projectDir: process.cwd() };
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    const value = () => {
      if (i + 1 >= rest.length) throw new Error(`${arg} needs a value`);
      return rest[++i];
    };
    if (arg === "--dir") options.projectDir = value();
    else if (arg === "--registry") options.registry = value();
    else if (arg === "--version") options.version = value();
    else if (arg === "--platforms") options.platforms = value();
    else if (arg === "--no-static-in-image") options.staticInImage = false;
    else if (arg === "--no-alias") options.alias = false;
    else throw new Error(`unknown option ${arg}`);
  }
  return { command, options };
}

try {
  const { command, options } = parse(process.argv.slice(2));
  if (command === "package") packageArtifacts(options);
  else if (command === "publish") publish(options);
  else {
    console.log(USAGE);
    process.exit(command === undefined || command === "help" || command === "--help" ? 0 : 1);
  }
} catch (error) {
  console.error(`konfidence-next: ${error.message}`);
  process.exit(1);
}
