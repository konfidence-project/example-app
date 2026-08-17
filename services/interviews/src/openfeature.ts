import { OpenFeature } from "@openfeature/server-sdk";
import { OFREPProvider } from "@openfeature/ofrep-provider";

const OFREP_URL = process.env.VECTOR_CONFIG_URL ?? "http://vector-data-service";

// Vector data is immutable per vector-id, so caching per (vector-id, flag) is safe.
const cache = new Map<string, boolean>();

export async function initOpenFeature(): Promise<void> {
  await OpenFeature.setProviderAndWait(new OFREPProvider({ baseUrl: OFREP_URL }));
  console.log(`openfeature: OFREP provider ready at ${OFREP_URL}`);
}

export async function isEnabled(
  vectorId: string,
  flag: string,
  defaultValue: boolean,
): Promise<boolean> {
  if (!vectorId) return defaultValue;
  const key = `${vectorId}::${flag}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const value = await OpenFeature.getClient("interviews").getBooleanValue(flag, defaultValue, {
    targetingKey: vectorId,
  });
  cache.set(key, value);
  return value;
}

// A Service exposed as a deployment result. Name is the stable konfidence.cloud/deployment-result value; the map is
// keyed by component basename.
interface DeploymentResultServiceSpec {
  Namespace: string;
  K8sName: string;
  ServicePorts: { name?: string; port: number }[];
}
interface DeploymentResult {
  name: string;
  type: string;
  spec: DeploymentResultServiceSpec;
}

const hostCache = new Map<string, string>();

// resolveServiceHost returns the cluster authority (host:port) of the deployment result with the given stable name.
// Throws if the vector has no such result. Evaluating the vector-id as a flag key returns the vector config.
export async function resolveServiceHost(vectorId: string, resultName: string): Promise<string> {
  if (!vectorId) throw new Error(`cannot resolve result ${resultName}: request has no vector-id`);

  const key = `${vectorId}::${resultName}`;
  const cached = hostCache.get(key);
  if (cached !== undefined) return cached;

  console.log(`[discovery] resolving result=${resultName} for vectorId=${vectorId} via OFREP ${OFREP_URL}`);
  const config = await OpenFeature.getClient("interviews").getObjectValue(vectorId, {}, {
    targetingKey: vectorId,
  });
  const { deploymentResults } = config as unknown as { deploymentResults: Record<string, DeploymentResult[]> };

  const match = Object.values(deploymentResults).flat().find((r) => r.name === resultName);
  if (!match) throw new Error(`vector ${vectorId} exposes no deployment result named ${resultName}`);

  const { Namespace, K8sName, ServicePorts } = match.spec;
  if (ServicePorts.length === 0) {
    throw new Error(`deployment result ${resultName} for vector ${vectorId} exposes no port`);
  }
  const authority = `${K8sName}.${Namespace}.svc.cluster.local:${ServicePorts[0].port}`;
  console.log(`[discovery] resolved result=${resultName} vectorId=${vectorId} -> ${authority}`);
  hostCache.set(key, authority);
  return authority;
}
